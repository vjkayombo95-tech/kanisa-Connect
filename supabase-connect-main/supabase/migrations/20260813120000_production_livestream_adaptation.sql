-- Production-specific, livestream-only member viewing and lifecycle foundation.

insert into public.platform_features (key, name, description, is_global, globally_enabled, globally_locked)
values ('livestream', 'Livestream', 'Tenant-scoped church live broadcasts.', true, true, false)
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.church_features (church_id, feature_id, enabled)
select c.id, f.id, false from public.churches c cross join public.platform_features f where f.key = 'livestream'
on conflict (church_id, feature_id) do nothing;

-- Production does not yet contain the later staging permission framework. Add
-- its minimal generic role/action primitive so livestream permissions are data,
-- not implications of a role name.
create table public.church_role_permissions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  role text not null check (role in ('church_admin','pastor','secretary','treasurer','member')),
  feature_id uuid not null references public.platform_features(id) on delete cascade,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  can_publish boolean not null default false,
  can_manage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, role, feature_id)
);
create index church_role_permissions_church_feature_idx on public.church_role_permissions(church_id, feature_id);

insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_edit, can_delete, can_manage
)
select c.id, r.role, f.id,
  r.role in ('church_admin','pastor'),
  r.role in ('church_admin','pastor'),
  r.role in ('church_admin','pastor'),
  r.role in ('church_admin','pastor'),
  r.role in ('church_admin','pastor')
from public.churches c
cross join (values ('church_admin'),('pastor'),('secretary'),('treasurer'),('member')) r(role)
cross join public.platform_features f
where f.key = 'livestream'
on conflict (church_id, role, feature_id) do nothing;

create table public.church_livestreams (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  title text not null check (length(trim(title)) between 1 and 200),
  provider text not null default 'youtube' check (provider = 'youtube'),
  watch_url text not null check (watch_url ~* '^https://[^[:space:]]+$'),
  provider_external_id text not null check (provider_external_id ~ '^[A-Za-z0-9_-]{11}$'),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_started_at timestamptz,
  actual_ended_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start),
  check (actual_ended_at is null or actual_started_at is null or actual_ended_at >= actual_started_at)
);

create unique index church_livestreams_one_live_per_church_idx on public.church_livestreams(church_id) where status = 'live';
create index church_livestreams_church_status_idx on public.church_livestreams(church_id, status, scheduled_start);

create or replace function public.livestream_feature_enabled(_church_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(bool_or(pf.globally_enabled and cf.enabled), false)
  from public.platform_features pf join public.church_features cf on cf.feature_id = pf.id
  where pf.key = 'livestream' and cf.church_id = _church_id;
$$;

create or replace function public.has_church_feature_permission(
  _user_id uuid, _church_id uuid, _feature_key text, _action text
)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select _user_id is not null and _user_id = auth.uid() and _church_id is not null
    and _action in ('view','create','edit','delete','approve','publish','manage')
    and exists (
      select 1
      from public.user_roles ur
      join public.church_role_permissions crp
        on crp.church_id = ur.church_id and crp.role = lower(ur.role::text)
      join public.platform_features pf on pf.id = crp.feature_id
      join public.church_features cf on cf.church_id = ur.church_id and cf.feature_id = pf.id
      where ur.user_id = _user_id and ur.church_id = _church_id
        and pf.key = _feature_key and pf.globally_enabled and cf.enabled
        and case _action
          when 'view' then crp.can_view when 'create' then crp.can_create
          when 'edit' then crp.can_edit when 'delete' then crp.can_delete
          when 'approve' then crp.can_approve when 'publish' then crp.can_publish
          when 'manage' then crp.can_manage else false end
    );
$$;

create or replace function public.has_livestream_permission(_user_id uuid, _church_id uuid, _action text default 'view')
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.has_church_feature_permission(_user_id, _church_id, 'livestream', _action);
$$;

create or replace function public.youtube_livestream_video_id(_url text)
returns text language plpgsql immutable set search_path = pg_catalog, public as $$
declare v_match text[];
begin
  v_match := regexp_match(_url, '^https://(?:www\.|m\.)?youtube\.com/watch\?[^#]*v=([A-Za-z0-9_-]{11})(?:[&#].*)?$', 'i');
  if v_match is null then v_match := regexp_match(_url, '^https://youtu\.be/([A-Za-z0-9_-]{11})(?:[/?#].*)?$', 'i'); end if;
  if v_match is null then v_match := regexp_match(_url, '^https://(?:www\.|m\.)?youtube\.com/(?:live|embed)/([A-Za-z0-9_-]{11})(?:[/?#].*)?$', 'i'); end if;
  return v_match[1];
end;
$$;

create or replace function public.enforce_production_livestream()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if public.youtube_livestream_video_id(new.watch_url) is distinct from new.provider_external_id then raise exception 'Validated YouTube identity mismatch' using errcode = '22023'; end if;
  if tg_op = 'INSERT' and new.status <> 'scheduled' then raise exception 'New livestreams must be scheduled' using errcode = '22023'; end if;
  if tg_op = 'UPDATE' and new.status <> old.status then
    if not public.has_livestream_permission(auth.uid(), old.church_id, 'manage') then raise exception 'Livestream manage permission required' using errcode = '42501'; end if;
    if not ((old.status='scheduled' and new.status in ('live','cancelled')) or (old.status='live' and new.status in ('ended','cancelled'))) then raise exception 'Invalid livestream transition' using errcode = '22023'; end if;
    if new.status='live' then new.actual_started_at := clock_timestamp(); new.actual_ended_at := null; end if;
    if old.status='live' and new.status in ('ended','cancelled') then new.actual_ended_at := clock_timestamp(); end if;
  end if;
  new.updated_at := clock_timestamp(); return new;
end;
$$;
create trigger enforce_production_livestream_trigger before insert or update on public.church_livestreams for each row execute function public.enforce_production_livestream();

alter table public.church_livestreams enable row level security;
create policy "Authorized tenant users view livestreams" on public.church_livestreams for select to authenticated using (public.has_livestream_permission(auth.uid(), church_id, 'view'));
create policy "Authorized tenant managers create livestreams" on public.church_livestreams for insert to authenticated with check (created_by=auth.uid() and public.has_livestream_permission(auth.uid(), church_id, 'create'));
create policy "Authorized tenant managers update livestreams" on public.church_livestreams for update to authenticated using (public.has_livestream_permission(auth.uid(), church_id, 'edit')) with check (public.has_livestream_permission(auth.uid(), church_id, 'edit'));
create policy "Authorized tenant managers delete scheduled livestreams" on public.church_livestreams for delete to authenticated using (status='scheduled' and public.has_livestream_permission(auth.uid(), church_id, 'delete'));

create or replace function public.transition_production_livestream(_livestream_id uuid, _new_status text)
returns public.church_livestreams language plpgsql security definer set search_path = pg_catalog, public as $$
declare v public.church_livestreams%rowtype;
begin
  select * into v from public.church_livestreams where id=_livestream_id for update;
  if not found then raise exception 'Livestream not found' using errcode='P0002'; end if;
  if not public.has_livestream_permission(auth.uid(), v.church_id, 'manage') then raise exception 'Livestream manage permission required' using errcode='42501'; end if;
  update public.church_livestreams set status=_new_status where id=_livestream_id returning * into v; return v;
end;
$$;

alter table public.church_role_permissions enable row level security;
revoke all on table public.church_role_permissions from public, anon, authenticated;
revoke all on table public.church_livestreams from public, anon, authenticated;
revoke all on function public.livestream_feature_enabled(uuid), public.has_church_feature_permission(uuid,uuid,text,text), public.has_livestream_permission(uuid,uuid,text), public.youtube_livestream_video_id(text), public.enforce_production_livestream(), public.transition_production_livestream(uuid,text) from public, anon, authenticated;
grant execute on function public.livestream_feature_enabled(uuid), public.has_church_feature_permission(uuid,uuid,text,text), public.has_livestream_permission(uuid,uuid,text), public.transition_production_livestream(uuid,text) to authenticated;
grant select, insert, update, delete on public.church_livestreams to authenticated;
