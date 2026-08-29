-- Align the staging Radio backend with the production Wave 5A contract.
-- Keep is_featured synchronized as a temporary legacy compatibility column.

alter table public.radio_stations
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

alter table public.church_radio_stations
  add column if not exists is_default boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

-- Staging historically called the single featured station the featured station.
-- Preserve that meaning exactly when introducing the production default name.
update public.church_radio_stations
set is_default = enabled and is_featured,
    is_featured = enabled and is_featured
where is_default is distinct from (enabled and is_featured)
   or is_featured is distinct from (enabled and is_featured);

alter table public.church_radio_stations
  drop constraint if exists church_radio_stations_default_requires_enabled,
  add constraint church_radio_stations_default_requires_enabled
    check (not is_default or enabled),
  drop constraint if exists church_radio_stations_default_featured_match,
  add constraint church_radio_stations_default_featured_match
    check (is_default = is_featured);

create unique index if not exists church_radio_stations_one_default_idx
  on public.church_radio_stations(church_id)
  where enabled and is_default;

create or replace function public.radio_feature_enabled(_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(bool_or(pf.globally_enabled and cf.enabled), false)
  from public.platform_features pf
  join public.church_features cf on cf.feature_id = pf.id
  where pf.key = 'radio' and cf.church_id = _church_id;
$$;

create or replace function public.has_radio_permission(
  _user_id uuid,
  _church_id uuid,
  _action text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.has_church_feature_permission(_user_id, _church_id, 'radio', _action);
$$;

-- PostgreSQL cannot rename input parameters with CREATE OR REPLACE, and the
-- staging and production five-argument RPCs otherwise have identical types.
drop function if exists public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer);

create function public.set_church_radio_selection(
  _church_id uuid,
  _radio_station_id uuid,
  _enabled boolean,
  _is_default boolean default false,
  _sort_order integer default 0
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.has_radio_permission(auth.uid(), _church_id, 'manage') then
    raise exception 'Radio management permission required' using errcode = '42501';
  end if;
  if _sort_order not between 0 and 10000 then
    raise exception 'Invalid station order' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.radio_stations
    where id = _radio_station_id and is_active and is_approved
  ) then
    raise exception 'Approved active station required' using errcode = '22023';
  end if;

  if _enabled and _is_default then
    update public.church_radio_stations
    set is_default = false,
        is_featured = false,
        updated_at = clock_timestamp()
    where church_id = _church_id and (is_default or is_featured);
  end if;

  insert into public.church_radio_stations (
    church_id, radio_station_id, enabled, is_default, is_featured,
    sort_order, created_by
  ) values (
    _church_id, _radio_station_id, _enabled,
    _enabled and _is_default, _enabled and _is_default,
    _sort_order, auth.uid()
  )
  on conflict (church_id, radio_station_id) do update
  set enabled = excluded.enabled,
      is_default = excluded.is_default,
      is_featured = excluded.is_featured,
      sort_order = excluded.sort_order,
      updated_at = clock_timestamp();
end;
$$;

-- Temporary named-argument compatibility for the currently deployed staging
-- Admin Radio screen. The extra defaulted argument gives PostgreSQL a distinct
-- signature; the wrapper delegates every check and write to production logic.
create or replace function public.set_church_radio_selection(
  _church_id uuid,
  _radio_station_id uuid,
  _enabled boolean,
  _is_featured boolean,
  _sort_order integer,
  _legacy_contract text default 'staging-is-featured'
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  perform public.set_church_radio_selection(
    _church_id, _radio_station_id, _enabled, _is_featured, _sort_order
  );
end;
$$;

alter table public.radio_stations enable row level security;
alter table public.church_radio_stations enable row level security;

drop policy if exists "Super admins manage platform radio directory" on public.radio_stations;
drop policy if exists "Church managers read approved radio directory" on public.radio_stations;
drop policy if exists "Members read selected approved active radio stations" on public.radio_stations;
drop policy if exists "Authorized users read church radio selections" on public.church_radio_stations;
drop policy if exists "Church managers add approved own-church radio selections" on public.church_radio_stations;
drop policy if exists "Church managers update approved own-church radio selections" on public.church_radio_stations;
drop policy if exists "Church managers remove own-church radio selections" on public.church_radio_stations;
drop policy if exists "Super admins manage radio directory" on public.radio_stations;
drop policy if exists "Authorized churches read usable radio directory" on public.radio_stations;
drop policy if exists "Authorized users read own church radio selections" on public.church_radio_stations;

create policy "Super admins manage radio directory"
on public.radio_stations
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

create policy "Authorized churches read usable radio directory"
on public.radio_stations
for select
to authenticated
using (
  is_active and is_approved and (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and public.has_radio_permission(auth.uid(), ur.church_id, 'manage')
    )
    or exists (
      select 1 from public.church_radio_stations selection
      where selection.radio_station_id = radio_stations.id
        and selection.enabled
        and public.has_radio_permission(auth.uid(), selection.church_id, 'view')
    )
  )
);

create policy "Authorized users read own church radio selections"
on public.church_radio_stations
for select
to authenticated
using (
  public.has_radio_permission(auth.uid(), church_id, 'manage')
  or (enabled and public.has_radio_permission(auth.uid(), church_id, 'view'))
);

revoke all on table public.radio_stations, public.church_radio_stations
  from public, anon, authenticated;
revoke all on function public.radio_feature_enabled(uuid),
  public.has_radio_permission(uuid,uuid,text),
  public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer),
  public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer,text)
  from public, anon, authenticated;

grant execute on function public.radio_feature_enabled(uuid),
  public.has_radio_permission(uuid,uuid,text),
  public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer),
  public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer,text)
  to authenticated;
grant select, insert, update, delete on public.radio_stations to authenticated;
grant select on public.church_radio_stations to authenticated;

comment on column public.church_radio_stations.is_featured is
  'Legacy staging alias retained in sync with the production is_default contract.';

comment on function public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer,text) is
  'Temporary staging is_featured named-argument compatibility wrapper; delegates to the production Radio selection contract.';
