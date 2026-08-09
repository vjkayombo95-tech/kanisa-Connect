-- Authoritative, tenant-scoped church livestream lifecycle.

insert into public.platform_features (
  key, name, description, is_global, globally_enabled, globally_locked,
  category, member_available, staff_available, available_plans
)
values (
  'livestream', 'Livestream', 'Schedule and manage authoritative church broadcasts.',
  true, true, false, 'Engagement', true, true,
  array['free','basic','intermediate','pro','enterprise']::text[]
)
on conflict (key) do update set
  member_available = true,
  staff_available = true,
  category = 'Engagement';

insert into public.church_features (church_id, feature_id, enabled, enabled_at)
select c.id, pf.id, true, now()
from public.churches c
join public.platform_features pf on pf.key = 'livestream'
on conflict (church_id, feature_id) do nothing;

insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
  can_approve, can_publish, can_manage
)
select c.id, role_name, pf.id, true,
  role_name = 'church_admin', role_name = 'church_admin', false, false,
  role_name = 'church_admin', role_name = 'church_admin'
from public.churches c
join public.platform_features pf on pf.key = 'livestream'
cross join unnest(array['church_admin','member']) role_name
on conflict (church_id, role, feature_id) do nothing;

create table if not exists public.church_livestreams (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  status text not null default 'scheduled'
    check (status in ('scheduled','live','ended','cancelled')),
  title text not null check (length(trim(title)) between 1 and 200),
  provider text not null default 'custom'
    check (provider in ('youtube','facebook','vimeo','custom')),
  watch_url text not null check (watch_url ~* '^https://[^[:space:]]+$'),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_started_at timestamptz,
  actual_ended_at timestamptz,
  recording_url text check (recording_url is null or recording_url ~* '^https://[^[:space:]]+$'),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~* '^https://[^[:space:]]+$'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start),
  check (actual_ended_at is null or actual_started_at is null or actual_ended_at >= actual_started_at)
);

create unique index if not exists church_livestreams_one_live_per_church_idx
  on public.church_livestreams(church_id) where status = 'live';
create index if not exists church_livestreams_church_status_start_idx
  on public.church_livestreams(church_id, status, scheduled_start);

create or replace function public.enforce_church_livestream_lifecycle()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'scheduled' then
      raise exception 'New livestreams must be scheduled' using errcode = '22023';
    end if;
    new.actual_started_at := null;
    new.actual_ended_at := null;
    new.created_by := coalesce(new.created_by, auth.uid());
  elsif new.status <> old.status then
    if not public.has_church_feature_permission(auth.uid(), old.church_id, 'livestream', 'manage') then
      raise exception 'Permission denied for livestream transition' using errcode = '42501';
    end if;
    if not (
      (old.status = 'scheduled' and new.status in ('live','cancelled')) or
      (old.status = 'live' and new.status in ('ended','cancelled'))
    ) then
      raise exception 'Invalid livestream transition: % to %', old.status, new.status using errcode = '22023';
    end if;
    if new.status = 'live' then
      new.actual_started_at := clock_timestamp();
      new.actual_ended_at := null;
    elsif old.status = 'live' and new.status in ('ended','cancelled') then
      new.actual_ended_at := clock_timestamp();
    end if;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists enforce_church_livestream_lifecycle_trigger on public.church_livestreams;
create trigger enforce_church_livestream_lifecycle_trigger
before insert or update on public.church_livestreams
for each row execute function public.enforce_church_livestream_lifecycle();

create or replace function public.audit_church_livestream_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.create_audit_log(
    case when tg_op = 'INSERT' then 'livestream.created' else 'livestream.updated' end,
    'church_livestream', new.id,
    case when tg_op = 'UPDATE' and old.status <> new.status
      then format('Livestream status changed from %s to %s', old.status, new.status)
      else format('Livestream %s', lower(tg_op)) end,
    jsonb_build_object('church_id', new.church_id, 'previous_status', case when tg_op = 'UPDATE' then old.status else null end, 'status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists audit_church_livestream_change_trigger on public.church_livestreams;
create trigger audit_church_livestream_change_trigger
after insert or update on public.church_livestreams
for each row execute function public.audit_church_livestream_change();

alter table public.church_livestreams enable row level security;

create policy "Authorized church users read livestreams"
on public.church_livestreams for select to authenticated
using (public.has_church_feature_permission(auth.uid(), church_id, 'livestream', 'view'));

create policy "Authorized church staff create livestreams"
on public.church_livestreams for insert to authenticated
with check (created_by = auth.uid() and public.has_church_feature_permission(auth.uid(), church_id, 'livestream', 'create'));

create policy "Authorized church staff update livestreams"
on public.church_livestreams for update to authenticated
using (public.has_church_feature_permission(auth.uid(), church_id, 'livestream', 'edit'))
with check (public.has_church_feature_permission(auth.uid(), church_id, 'livestream', 'edit'));

create policy "Authorized church staff delete scheduled livestreams"
on public.church_livestreams for delete to authenticated
using (status = 'scheduled' and public.has_church_feature_permission(auth.uid(), church_id, 'livestream', 'delete'));

create or replace function public.transition_church_livestream(_livestream_id uuid, _new_status text)
returns public.church_livestreams
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_stream public.church_livestreams%rowtype;
begin
  if _new_status not in ('live','ended','cancelled') then
    raise exception 'Unsupported livestream status' using errcode = '22023';
  end if;
  select * into v_stream from public.church_livestreams where id = _livestream_id for update;
  if not found then raise exception 'Livestream not found' using errcode = 'P0002'; end if;
  if not public.has_church_feature_permission(auth.uid(), v_stream.church_id, 'livestream', 'manage') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  update public.church_livestreams set status = _new_status where id = _livestream_id returning * into v_stream;
  return v_stream;
end;
$$;

revoke all on function public.transition_church_livestream(uuid, text) from public, anon;
grant execute on function public.transition_church_livestream(uuid, text) to authenticated;
grant select, insert, update, delete on public.church_livestreams to authenticated;

comment on table public.church_livestreams is 'Authoritative church broadcast lifecycle; live status is changed only by explicit authorized action.';
