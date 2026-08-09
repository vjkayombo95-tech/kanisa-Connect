-- DRAFT ONLY - Phase 2B review required before this migration may be applied.
-- Reviewed staging project: nunfrjcuimaytydnaqtt
-- Reviewed source HEAD: 0fd3a1ba5014eca6b866d05941af8addb4a88836
-- Provenance for every created row: phase2_backfill_v1
-- The evidence-source combination remains reproducible from the Phase 2A dry run.

begin;

-- Serialize this one-time backfill and fail if a concurrent writer changes a
-- source table after the reviewed fingerprints are checked.
lock table public.church_memberships, public.members, public.user_roles,
  public.profiles, public.church_staff, public.community_leaders,
  public.churches in share row exclusive mode;

create temporary table phase2_before_business_counts (
  table_name text primary key,
  row_count bigint not null
) on commit drop;

do $$
declare r record;
begin
  for r in
    select c.oid::regclass as relation_name, c.relname as table_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
      and c.relname not in ('church_memberships','members','user_roles')
    order by c.relname
  loop
    execute format('insert into phase2_before_business_counts values (%L, (select count(*) from %s))',
                   r.table_name, r.relation_name);
  end loop;
end $$;

do $$
declare f text;
begin
  select md5(string_agg(table_name||'|'||row_count::text,E'\n' order by table_name))
    into f from phase2_before_business_counts;
  if f <> '7761ee664708dd09440d7a9c9246b7f5' then raise exception 'Reviewed business-count fingerprint mismatch'; end if;
  if (select count(*) from supabase_migrations.schema_migrations where version='20260728120000') <> 1
     or (select max(version) from supabase_migrations.schema_migrations) <> '20260728120000' then
    raise exception 'Migration history changed after Phase 1 review';
  end if;
  select md5(coalesce(string_agg(schemaname||'|'||tablename||'|'||policyname||'|'||cmd||'|'||permissive||'|'||coalesce(qual,'<null>')||'|'||coalesce(with_check,'<null>'),E'\n' order by schemaname,tablename,policyname),''))
    into f from pg_policies where schemaname='public';
  if f <> '2df33b2421286e6b85260432be1aecc6' then raise exception 'Reviewed policy fingerprint mismatch'; end if;
  select md5(coalesce(string_agg(p.oid::regprocedure::text||'|'||md5(pg_get_functiondef(p.oid)),E'\n' order by p.oid::regprocedure::text),''))
    into f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
  if f <> '5afda7308afb7c19c6f3b93e249c6568' then raise exception 'Reviewed function fingerprint mismatch'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='unique_user_member'
                 and indexdef='CREATE UNIQUE INDEX unique_user_member ON public.members USING btree (user_id) WHERE (user_id IS NOT NULL)') then
    raise exception 'Reviewed unique_user_member definition changed';
  end if;
end $$;

create temporary table phase2_candidates on commit drop as
with
m as (
  select user_id, church_id, count(*)::integer member_count,
         count(*) filter (where lower(coalesce(status,'')) = 'active')::integer active_member_count,
         array_agg(distinct lower(coalesce(status,'<null>')) order by lower(coalesce(status,'<null>'))) statuses,
         min(created_at at time zone 'UTC') filter (where lower(coalesce(status,'')) = 'active') active_member_at,
         min(created_at at time zone 'UTC') any_member_at
  from public.members where user_id is not null and church_id is not null
  group by user_id, church_id
),
r as (
  select user_id, church_id, count(*)::integer role_count, min(created_at) role_at
  from public.user_roles where user_id is not null and church_id is not null
  group by user_id, church_id
),
p as (
  select id user_id, church_id, created_at at time zone 'UTC' profile_at
  from public.profiles where church_id is not null
),
s as (
  select user_id, church_id, count(*)::integer staff_count,
         min(created_at at time zone 'UTC') staff_at
  from public.church_staff where user_id is not null and church_id is not null
  group by user_id, church_id
),
l as (
  select user_id, church_id, count(*)::integer leader_count
  from public.community_leaders where user_id is not null and church_id is not null
  group by user_id, church_id
),
o as (
  select owner_id user_id, id church_id, created_at at time zone 'UTC' owner_at
  from public.churches where owner_id is not null
),
c as (
  select created_by user_id, id church_id, created_at at time zone 'UTC' creator_at
  from public.churches where created_by is not null
),
k as (
  select user_id, church_id from m union select user_id, church_id from r
  union select user_id, church_id from p union select user_id, church_id from s
  union select user_id, church_id from l union select user_id, church_id from o
  union select user_id, church_id from c
),
e as (
  select k.user_id, k.church_id,
         coalesce(m.member_count,0) member_count,
         coalesce(m.active_member_count,0) active_member_count,
         coalesce(m.statuses,array[]::text[]) statuses,
         m.active_member_at, m.any_member_at,
         coalesce(r.role_count,0) role_count, r.role_at,
         coalesce(s.staff_count,0) staff_count, s.staff_at,
         coalesce(l.leader_count,0) leader_count,
         (p.user_id is not null) profile_evidence, p.profile_at,
         (o.user_id is not null) owner_evidence, o.owner_at,
         (c.user_id is not null) creator_evidence, c.creator_at
  from k left join m using (user_id,church_id) left join r using (user_id,church_id)
  left join p using (user_id,church_id) left join s using (user_id,church_id)
  left join l using (user_id,church_id) left join o using (user_id,church_id)
  left join c using (user_id,church_id)
),
d as (
  select e.*,
    case when active_member_count > 0 then 'active'
         when role_count > 0 or staff_count > 0 or leader_count > 0
           or profile_evidence or owner_evidence or creator_evidence then 'active'
         when statuses && array['suspended']::text[] then 'suspended'
         when statuses && array['revoked']::text[] then 'revoked'
         when statuses && array['left']::text[] then 'left'
         when statuses && array['pending']::text[] then 'pending' end proposed_status,
    coalesce(active_member_at,role_at,staff_at,profile_at,
             least(owner_at,creator_at),owner_at,creator_at,any_member_at) joined_at,
    case when member_count > 0 and active_member_count = 0
               and (role_count > 0 or staff_count > 0 or leader_count > 0
                    or profile_evidence or owner_evidence or creator_evidence)
           then 'manual_review'
         when member_count > 0 and active_member_count = 0
               and not (statuses <@ array['pending','suspended','revoked','left']::text[])
           then 'manual_review'
         when member_count = 0 and role_count = 0 and staff_count = 0
               and leader_count = 0 and not profile_evidence
               and (owner_evidence or creator_evidence)
           then 'deterministic_with_warning'
         when member_count = 0 and role_count > 0 and staff_count = 0
               and leader_count = 0 and not profile_evidence
               and not owner_evidence and not creator_evidence
           then 'deterministic_with_warning'
         else 'deterministic' end confidence_level,
    case when member_count = 0 and role_count = 0 and staff_count = 0
               and leader_count = 0 and not profile_evidence
               and (owner_evidence or creator_evidence)
           then 'Phase 0 review: current authorization recognizes owner/creator; product should confirm this legacy relationship remains active.'
         when member_count = 0 and role_count > 0 and staff_count = 0
               and leader_count = 0 and not profile_evidence
               and not owner_evidence and not creator_evidence
           then 'Current tenant role is authoritative but no same-church member row exists.'
         when member_count > 0 and active_member_count = 0
               and (role_count > 0 or staff_count > 0 or leader_count > 0
                    or profile_evidence or owner_evidence or creator_evidence)
           then 'Inactive member evidence conflicts with a current relationship source.'
         when member_count > 0 and active_member_count = 0
           then 'Legacy member status has no approved canonical mapping.' end manual_review_reason,
    case when profile_evidence then 1 when active_member_count > 0 then 2
         when role_count > 0 then 3 when owner_evidence or creator_evidence then 4 else 5 end primary_precedence
  from e
),
q as (
  select d.*,
    row_number() over (partition by user_id order by
      case when proposed_status = 'active' then 0 else 1 end,
      primary_precedence, joined_at asc nulls last, church_id::text asc) primary_rank
  from d
)
select user_id, church_id, proposed_status::public.church_membership_status status,
       joined_at, (proposed_status = 'active' and primary_rank = 1) is_primary,
       confidence_level, manual_review_reason
from q;

do $$
declare
  v text;
begin
  if (select count(*) from public.church_memberships) <> 0 then
    raise exception 'Phase 2 foundation is not empty';
  end if;
  if (select count(*) from public.members where membership_id is not null) <> 0
     or (select count(*) from public.user_roles where membership_id is not null) <> 0 then
    raise exception 'Transitional links already exist';
  end if;
  if (select count(*) from phase2_candidates) <> 25 then
    raise exception 'Candidate count differs from reviewed baseline';
  end if;
  select md5(string_agg(user_id::text || '|' || church_id::text,
                        E'\n' order by user_id::text,church_id::text)) into v
  from phase2_candidates;
  if v <> '4ec00bae1955839ac0ff6d5b54a82829' then raise exception 'Candidate fingerprint mismatch: %',v; end if;
  select md5(string_agg(user_id::text || '|' || church_id::text || '|' || status::text,
                        E'\n' order by user_id::text,church_id::text)) into v
  from phase2_candidates;
  if v <> 'e926b540ea4f883b435b5fdadec3e5b0' then raise exception 'Status fingerprint mismatch: %',v; end if;
  select md5(string_agg(user_id::text || '|' || church_id::text || '|' ||
                        to_char(joined_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US') || 'Z',
                        E'\n' order by user_id::text,church_id::text)) into v
  from phase2_candidates;
  if v <> 'f78fda313cb1d3ad58fc6dce23953314' then raise exception 'joined_at fingerprint mismatch: %',v; end if;
  select md5(string_agg(user_id::text || '|' || church_id::text || '|' || is_primary::text,
                        E'\n' order by user_id::text,church_id::text)) into v
  from phase2_candidates;
  if v <> '59e610cb38b70fd6cf86129821f03143' then raise exception 'Primary fingerprint mismatch: %',v; end if;
  select md5(string_agg(user_id::text || '|' || church_id::text || '|' || confidence_level || '|' || coalesce(manual_review_reason,''),
                        E'\n' order by user_id::text,church_id::text)
             filter (where confidence_level <> 'deterministic')) into v
  from phase2_candidates;
  if v <> '616053c1503df6736f596efbd62b1811' then raise exception 'Review-list fingerprint mismatch: %',v; end if;
  if exists (select 1 from phase2_candidates where user_id is null or church_id is null
             or status is null or joined_at is null or confidence_level = 'manual_review') then
    raise exception 'Ambiguous, incomplete, or blocking candidate exists';
  end if;
  if exists (select 1 from phase2_candidates group by user_id,church_id having count(*) > 1) then
    raise exception 'Duplicate candidate exists';
  end if;
  if exists (select 1 from phase2_candidates where is_primary and status <> 'active')
     or exists (select 1 from phase2_candidates where is_primary group by user_id having count(*) > 1) then
    raise exception 'Invalid proposed primary assignment';
  end if;
end $$;

-- Fail closed on any source change since Phase 2A review.
do $$
declare v text;
begin
  select md5(string_agg(id::text || '|' || md5((to_jsonb(m)-'membership_id')::text),E'\n' order by id::text)) into v from public.members m;
  if v <> 'e7fc8fbf7c8a2eb3ca2f2a48c05818cb' then raise exception 'Member source fingerprint mismatch'; end if;
  select md5(string_agg(id::text || '|' || md5((to_jsonb(r)-'membership_id')::text),E'\n' order by id::text)) into v from public.user_roles r where user_id is not null and church_id is not null;
  if v <> '52867af5a90ed75e04a2ad4c7d4960ab' then raise exception 'Role source fingerprint mismatch'; end if;
  select md5(string_agg(id::text || '|' || md5(to_jsonb(p)::text),E'\n' order by id::text)) into v from public.profiles p;
  if v <> '1eb55b3c71090e53b1a54943788da7b4' then raise exception 'Profile source fingerprint mismatch'; end if;
  select md5(string_agg(c.id::text||'|'||coalesce(c.owner_id::text,'<null>')||'|'||coalesce(c.created_by::text,'<null>')||'|'||coalesce(to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),'<null>'),E'\n' order by c.id::text)) into v from public.churches c;
  if v <> '5187918ccf29670dfe1cb8b78ad9577e' then raise exception 'Church relationship source fingerprint mismatch'; end if;
  select md5(coalesce(string_agg(s.id::text||'|'||coalesce(s.user_id::text,'<null>')||'|'||coalesce(s.church_id::text,'<null>')||'|'||coalesce(s.role,'<null>')||'|'||coalesce(s.created_at::text,'<null>'),E'\n' order by s.id::text),'')) into v from public.church_staff s;
  if v <> 'd41d8cd98f00b204e9800998ecf8427e' then raise exception 'Staff source fingerprint mismatch'; end if;
  select md5(coalesce(string_agg(l.id::text||'|'||coalesce(l.user_id::text,'<null>')||'|'||coalesce(l.church_id::text,'<null>')||'|'||coalesce(l.leadership_role,'<null>'),E'\n' order by l.id::text),'')) into v from public.community_leaders l;
  if v <> 'd41d8cd98f00b204e9800998ecf8427e' then raise exception 'Leadership source fingerprint mismatch'; end if;
end $$;

insert into public.church_memberships
  (user_id,church_id,status,joined_at,is_primary,membership_source)
select user_id,church_id,status,joined_at,is_primary,'phase2_backfill_v1'
from phase2_candidates
order by user_id::text,church_id::text;

do $$ begin
  if (select count(*) from public.church_memberships where membership_source='phase2_backfill_v1') <> 25
     or (select count(*) from public.church_memberships) <> 25 then
    raise exception 'Inserted membership count mismatch';
  end if;
end $$;

update public.members m
set membership_id = cm.id
from public.church_memberships cm
where m.user_id is not null and m.church_id is not null
  and cm.user_id=m.user_id and cm.church_id=m.church_id
  and m.membership_id is null;

update public.user_roles ur
set membership_id = cm.id
from public.church_memberships cm
where ur.user_id is not null and ur.church_id is not null
  and cm.user_id=ur.user_id and cm.church_id=ur.church_id
  and ur.membership_id is null;

do $$
declare r record; v bigint; f text;
begin
  if (select count(*) from public.members where membership_id is not null) <> 21 then raise exception 'Member link count mismatch'; end if;
  if (select count(*) from public.user_roles where membership_id is not null) <> 26 then raise exception 'Role link count mismatch'; end if;
  if exists (select 1 from public.members m join public.church_memberships cm on cm.id=m.membership_id where cm.user_id<>m.user_id or cm.church_id<>m.church_id)
     or exists (select 1 from public.user_roles ur join public.church_memberships cm on cm.id=ur.membership_id where cm.user_id<>ur.user_id or cm.church_id<>ur.church_id) then
    raise exception 'Cross-church or cross-user link detected';
  end if;
  if exists (select 1 from public.members m where m.user_id is not null and m.church_id is not null and m.membership_id is null)
     or exists (select 1 from public.user_roles r where r.user_id is not null and r.church_id is not null and r.membership_id is null) then
    raise exception 'Eligible source row remains unlinked';
  end if;
  if exists (select 1 from public.members m left join public.church_memberships cm on cm.id=m.membership_id where m.membership_id is not null and cm.id is null)
     or exists (select 1 from public.user_roles r left join public.church_memberships cm on cm.id=r.membership_id where r.membership_id is not null and cm.id is null) then
    raise exception 'Orphan membership reference detected';
  end if;
  select md5(string_agg(id::text || '|' || md5((to_jsonb(m)-'membership_id')::text),E'\n' order by id::text)) into f from public.members m;
  if f <> 'e7fc8fbf7c8a2eb3ca2f2a48c05818cb' then raise exception 'Legacy member fields changed'; end if;
  select md5(string_agg(id::text || '|' || md5((to_jsonb(x)-'membership_id')::text),E'\n' order by id::text)) into f from public.user_roles x where user_id is not null and church_id is not null;
  if f <> '52867af5a90ed75e04a2ad4c7d4960ab' then raise exception 'Legacy role fields changed'; end if;
  select md5(string_agg(id::text || '|' || md5(to_jsonb(p)::text),E'\n' order by id::text)) into f from public.profiles p;
  if f <> '1eb55b3c71090e53b1a54943788da7b4' then raise exception 'Profiles changed'; end if;
  for r in select * from phase2_before_business_counts loop
    execute format('select count(*) from public.%I',r.table_name) into v;
    if v <> r.row_count then raise exception 'Business row count changed for %',r.table_name; end if;
  end loop;
  select md5(coalesce(string_agg(schemaname||'|'||tablename||'|'||policyname||'|'||cmd||'|'||permissive||'|'||coalesce(qual,'<null>')||'|'||coalesce(with_check,'<null>'),E'\n' order by schemaname,tablename,policyname),'')) into f from pg_policies where schemaname='public';
  if f <> '2df33b2421286e6b85260432be1aecc6' then raise exception 'Policy fingerprint changed'; end if;
  select md5(coalesce(string_agg(p.oid::regprocedure::text||'|'||md5(pg_get_functiondef(p.oid)),E'\n' order by p.oid::regprocedure::text),'')) into f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
  if f <> '5afda7308afb7c19c6f3b93e249c6568' then raise exception 'Authorization/function fingerprint changed'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='unique_user_member') then raise exception 'unique_user_member changed'; end if;
end $$;

commit;
