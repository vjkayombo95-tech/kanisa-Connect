-- Phase 3B.1 draft: additive, caller-bound canonical membership reads.
--
-- DESIGN STATUS ONLY: do not apply without explicit Phase 3B.1 approval.
-- This migration does not replace legacy helpers, add RLS policies, grant
-- table access, or make canonical memberships authoritative.

create or replace function public.get_my_church_memberships()
returns table (
  membership_id uuid,
  church_id uuid,
  church_code text,
  church_name text,
  status text,
  is_primary boolean,
  joined_at timestamptz,
  membership_source text,
  explicit_roles text[],
  baseline_member boolean,
  effective_compatibility_roles text[]
)
language sql
stable
parallel unsafe
security definer
set search_path = pg_catalog, public
as $$
  select
    cm.id,
    cm.church_id,
    c.church_code,
    c.name,
    cm.status::text,
    cm.is_primary,
    cm.joined_at,
    cm.membership_source,
    explicit_role_context.roles,
    baseline_context.baseline_member,
    array(
      select role
      from (
        select unnest(explicit_role_context.roles) as role
        union
        select 'member'::text where baseline_context.baseline_member
      ) effective_roles
      order by role
    )
  from public.church_memberships cm
  join public.churches c on c.id = cm.church_id
  left join lateral (
    select coalesce(array_agg(role order by role), array[]::text[]) as roles
    from (
      select distinct lower(ur.role::text) as role
      from public.user_roles ur
      where ur.membership_id = cm.id
        and ur.user_id = cm.user_id
        and ur.church_id = cm.church_id
    ) membership_roles
  ) explicit_role_context on true
  left join lateral (
    select exists (
      select 1 from public.members m
      where m.membership_id = cm.id
        and m.user_id = cm.user_id
        and m.church_id = cm.church_id
        and lower(coalesce(m.status, 'active')) in ('active', 'approved')
    ) as baseline_member
  ) baseline_context on true
  where cm.user_id = (select auth.uid())
    and cm.status = 'active'
  order by cm.is_primary desc, cm.joined_at, cm.id;
$$;

comment on function public.get_my_church_memberships() is
  'Phase 3 shadow-read RPC. Returns only the authenticated caller active canonical memberships; it does not authorize or select a workspace.';

create or replace function public.get_my_primary_church_membership()
returns table (
  membership_id uuid,
  church_id uuid,
  church_code text,
  church_name text,
  status text,
  is_primary boolean,
  joined_at timestamptz,
  membership_source text,
  explicit_roles text[],
  baseline_member boolean,
  effective_compatibility_roles text[]
)
language plpgsql
stable
parallel unsafe
security definer
set search_path = pg_catalog, public
as $$
declare
  v_primary_count integer;
begin
  select count(*) into v_primary_count
  from public.get_my_church_memberships() m
  where m.is_primary;

  if v_primary_count > 1 then
    raise exception using
      errcode = '23514',
      message = 'Canonical membership integrity violation: multiple active primary memberships.';
  end if;

  return query
  select m.*
  from public.get_my_church_memberships() m
  where m.is_primary
  order by m.joined_at, m.membership_id;
end;
$$;

comment on function public.get_my_primary_church_membership() is
  'Phase 3 shadow-read RPC. Returns the authenticated caller active primary membership without changing legacy context.';

create or replace function public.get_my_membership_roles(_membership_id uuid)
returns table (role text)
language sql
stable
parallel unsafe
security definer
set search_path = pg_catalog, public
as $$
  select distinct lower(ur.role::text) as role
  from public.church_memberships cm
  join public.user_roles ur
    on ur.membership_id = cm.id
   and ur.user_id = cm.user_id
   and ur.church_id = cm.church_id
  where cm.id = _membership_id
    and cm.user_id = (select auth.uid())
    and cm.status = 'active'
  order by 1;
$$;

comment on function public.get_my_membership_roles(uuid) is
  'Phase 3 caller-bound stored-role read. A supplied membership ID is accepted only when it is active and owned by auth.uid(); baseline member compatibility is returned separately by context helpers.';

create or replace function public.get_my_canonical_church_context()
returns jsonb
language plpgsql
stable
parallel unsafe
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_memberships jsonb := '[]'::jsonb;
  v_active_count integer := 0;
  v_primary_count integer := 0;
  v_primary_membership_id uuid;
  v_primary_church_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object(
      'authenticated', false,
      'active_membership_count', 0,
      'primary_membership_count', 0,
      'primary_membership_id', null,
      'primary_church_id', null,
      'memberships', '[]'::jsonb,
      'generated_at', statement_timestamp()
    );
  end if;

  with memberships as materialized (
    select * from public.get_my_church_memberships()
  )
  select
    count(*),
    count(*) filter (where m.is_primary),
    (array_agg(m.membership_id order by m.joined_at, m.membership_id)
      filter (where m.is_primary))[1],
    (array_agg(m.church_id order by m.joined_at, m.membership_id)
      filter (where m.is_primary))[1],
    coalesce(
      jsonb_agg(to_jsonb(m) order by m.is_primary desc, m.joined_at, m.membership_id),
      '[]'::jsonb
    )
  into v_active_count, v_primary_count, v_primary_membership_id,
    v_primary_church_id, v_memberships
  from memberships m;

  if v_primary_count > 1 then
    v_primary_membership_id := null;
    v_primary_church_id := null;
  end if;

  return jsonb_build_object(
    'authenticated', true,
    'active_membership_count', v_active_count,
    'primary_membership_count', v_primary_count,
    'primary_membership_id', v_primary_membership_id,
    'primary_church_id', v_primary_church_id,
    'memberships', v_memberships,
    'generated_at', statement_timestamp()
  );
end;
$$;

comment on function public.get_my_canonical_church_context() is
  'Phase 3 shadow context. This output must not replace get_current_user_context until a separately approved cutover.';

create or replace function public.compare_my_legacy_and_canonical_context()
returns jsonb
language plpgsql
stable
parallel unsafe
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_legacy jsonb;
  v_legacy_church_id uuid;
  v_primary_church_id uuid;
  v_total_count integer := 0;
  v_active_count integer := 0;
  v_legacy_roles text[] := array[]::text[];
  v_canonical_explicit_roles text[] := array[]::text[];
  v_canonical_effective_roles text[] := array[]::text[];
  v_baseline_member boolean := false;
  v_active_match boolean := false;
  v_inactive_match boolean := false;
  v_invalid boolean := false;
  v_unsupported_legacy_fallback boolean := false;
  v_missing_role_link boolean := false;
  v_mismatch text := 'unknown';
  v_severity text := 'blocker';
begin
  if v_user_id is null then
    return jsonb_build_object(
      'user_id_redacted', null,
      'mismatch_type', 'unknown',
      'severity', 'blocker',
      'generated_at', statement_timestamp(),
      'diagnostic_only', true
    );
  end if;

  -- Legacy context remains authoritative. This call observes it only.
  v_legacy := public.get_current_user_context();
  v_legacy_church_id := nullif(v_legacy ->> 'church_id', '')::uuid;

  select
    count(*),
    count(*) filter (where cm.status = 'active'),
    (array_agg(cm.church_id order by cm.joined_at, cm.id)
      filter (where cm.status = 'active' and cm.is_primary))[1]
  into v_total_count, v_active_count, v_primary_church_id
  from public.church_memberships cm
  where cm.user_id = v_user_id;

  select coalesce(array_agg(value order by value), array[]::text[])
  into v_legacy_roles
  from jsonb_array_elements_text(coalesce(v_legacy -> 'roles', '[]'::jsonb)) value;

  select
    coalesce(bool_or(cm.status = 'active'), false),
    coalesce(bool_or(cm.status <> 'active'), false)
  into v_active_match, v_inactive_match
  from public.church_memberships cm
  where cm.user_id = v_user_id
    and cm.church_id = v_legacy_church_id;

  select
    coalesce(
      array_agg(distinct lower(ur.role::text) order by lower(ur.role::text))
        filter (where ur.id is not null),
      array[]::text[]
    ),
    coalesce(bool_or(
      m.id is not null
      and lower(coalesce(m.status, 'active')) in ('active', 'approved')
    ), false)
  into v_canonical_explicit_roles, v_baseline_member
  from public.church_memberships cm
  left join public.user_roles ur on ur.membership_id = cm.id
    and ur.user_id = cm.user_id and ur.church_id = cm.church_id
  left join public.members m on m.membership_id = cm.id
    and m.user_id = cm.user_id and m.church_id = cm.church_id
  where cm.user_id = v_user_id and cm.church_id = v_legacy_church_id
    and cm.status = 'active';

  select coalesce(array_agg(role order by role), array[]::text[])
  into v_canonical_effective_roles
  from (
    select unnest(v_canonical_explicit_roles) as role
    union
    select 'member'::text where v_baseline_member
  ) compatibility_roles;

  select
    not exists (
      select 1 from public.user_roles ur where ur.user_id = v_user_id
    )
    and not exists (
      select 1 from public.profiles p where p.id = v_user_id and p.church_id is not null
    )
    and (
      (select count(distinct m.church_id) from public.members m
        where m.user_id = v_user_id and m.church_id is not null) > 1
      or (
        (select count(distinct m.church_id) from public.members m
          where m.user_id = v_user_id and m.church_id is not null) = 0
        and (select count(distinct c.id) from public.churches c
          where c.created_by = v_user_id) > 1
      )
    )
  into v_unsupported_legacy_fallback;

  select exists (
    select 1 from unnest(v_legacy_roles) legacy_role
    where not (legacy_role = any(v_canonical_effective_roles))
  ) into v_missing_role_link;

  select
    count(*) <> count(distinct cm.church_id)
    or count(*) filter (where cm.is_primary and cm.status = 'active') > 1
    or exists (
      select 1
      from public.user_roles ur
      join public.church_memberships linked on linked.id = ur.membership_id
      where ur.user_id = v_user_id
        and (ur.user_id is distinct from linked.user_id
          or ur.church_id is distinct from linked.church_id)
    )
  into v_invalid
  from public.church_memberships cm
  where cm.user_id = v_user_id;

  if coalesce((v_legacy ->> 'is_super_admin')::boolean, false) then
    v_mismatch := 'platform_global_exemption';
    v_severity := 'informational';
  elsif v_invalid then
    v_mismatch := 'duplicate_or_invalid_canonical_state';
  elsif v_unsupported_legacy_fallback then
    v_mismatch := 'unsupported_legacy_fallback';
  elsif v_legacy_church_id is null and v_active_count > 0 then
    v_mismatch := 'legacy_church_missing';
    v_severity := 'warning';
  elsif v_legacy_church_id is not null and not v_active_match and v_inactive_match then
    v_mismatch := 'inactive_canonical_membership';
  elsif v_legacy_church_id is not null and not v_active_match then
    v_mismatch := 'canonical_membership_missing';
  elsif v_missing_role_link then
    v_mismatch := 'role_link_missing';
  elsif v_legacy_roles is distinct from v_canonical_effective_roles then
    v_mismatch := 'church_match_role_difference';
  elsif v_primary_church_id is distinct from v_legacy_church_id then
    v_mismatch := 'canonical_primary_difference';
    v_severity := 'warning';
  else
    v_mismatch := 'exact_match';
    v_severity := 'informational';
  end if;

  return jsonb_build_object(
    'user_id_redacted', substr(md5(v_user_id::text), 1, 12),
    'legacy_church_id', v_legacy_church_id,
    'canonical_primary_church_id', v_primary_church_id,
    'canonical_membership_count', v_total_count,
    'canonical_active_membership_count', v_active_count,
    'legacy_roles', to_jsonb(v_legacy_roles),
    'canonical_explicit_roles_for_legacy_church', to_jsonb(v_canonical_explicit_roles),
    'canonical_baseline_member', v_baseline_member,
    'canonical_effective_compatibility_roles', to_jsonb(v_canonical_effective_roles),
    'church_match', v_active_match,
    'role_match', v_legacy_roles = v_canonical_effective_roles,
    'membership_exists_for_legacy_church', v_active_match,
    'primary_match', v_primary_church_id is not distinct from v_legacy_church_id,
    'mismatch_type', v_mismatch,
    'severity', v_severity,
    'generated_at', statement_timestamp(),
    'diagnostic_only', true
  );
end;
$$;

comment on function public.compare_my_legacy_and_canonical_context() is
  'Phase 3 non-enforcing, PII-free comparison. It must never grant, deny, redirect, or select an active church.';

-- Supabase migrations run as the database owner. Keep ownership explicit so
-- SECURITY DEFINER cannot inherit ownership from a deployment wrapper role.
alter function public.get_my_church_memberships() owner to postgres;
alter function public.get_my_primary_church_membership() owner to postgres;
alter function public.get_my_membership_roles(uuid) owner to postgres;
alter function public.get_my_canonical_church_context() owner to postgres;
alter function public.compare_my_legacy_and_canonical_context() owner to postgres;

-- SECURITY DEFINER functions receive PUBLIC EXECUTE by default; remove it.
revoke all on function public.get_my_church_memberships() from public, anon, authenticated;
revoke all on function public.get_my_primary_church_membership() from public, anon, authenticated;
revoke all on function public.get_my_membership_roles(uuid) from public, anon, authenticated;
revoke all on function public.get_my_canonical_church_context() from public, anon, authenticated;
revoke all on function public.compare_my_legacy_and_canonical_context() from public, anon, authenticated;

grant execute on function public.get_my_church_memberships() to authenticated, service_role;
grant execute on function public.get_my_primary_church_membership() to authenticated, service_role;
grant execute on function public.get_my_membership_roles(uuid) to authenticated, service_role;
grant execute on function public.get_my_canonical_church_context() to authenticated, service_role;
grant execute on function public.compare_my_legacy_and_canonical_context() to authenticated, service_role;

-- Intentionally absent:
-- * table grants to authenticated or anon
-- * policies on church_memberships
-- * replacements for legacy helpers
-- * authorization, route, navigation, or active-church changes
