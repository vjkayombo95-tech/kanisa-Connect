-- Centralize technical Radio configuration under Platform/Super Admin control.
-- Audio remains direct from the provider to the member browser.

create table public.radio_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  stream_url text not null unique check (public.is_safe_public_https_url(stream_url)),
  website_url text check (website_url is null or public.is_safe_public_https_url(website_url)),
  logo_url text check (logo_url is null or public.is_safe_public_https_url(logo_url)),
  description text check (description is null or length(description) <= 500),
  provider text,
  stream_format text,
  metadata_url text check (metadata_url is null or public.is_safe_public_https_url(metadata_url)),
  is_active boolean not null default true,
  is_approved boolean not null default false,
  health_status text check (health_status is null or health_status in ('unknown','working','failed','needs_attention')),
  last_health_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_radio_stations
before update on public.radio_stations
for each row execute function public.update_updated_at_column();

alter table public.church_radio_stations
  add column radio_station_id uuid references public.radio_stations(id) on delete restrict,
  add column enabled boolean not null default true;

-- Remove policies that depend on technical columns before those columns move.
drop policy if exists "Members read active church radio stations" on public.church_radio_stations;
drop policy if exists "Church admins read all own radio stations" on public.church_radio_stations;
drop policy if exists "Church admins create own radio stations" on public.church_radio_stations;
drop policy if exists "Church admins update own radio stations" on public.church_radio_stations;
drop policy if exists "Church admins delete own radio stations" on public.church_radio_stations;

-- Preserve every distinct configured endpoint, including staging Radio Maria data.
insert into public.radio_stations (
  name, stream_url, website_url, logo_url, description, provider, stream_format, metadata_url,
  is_active, is_approved, created_at, updated_at
)
select distinct on (stream_url)
  name, stream_url, website_url, logo_url, description, provider, stream_format, metadata_url,
  is_active, true, created_at, updated_at
from public.church_radio_stations
order by stream_url, is_featured desc, created_at;

update public.church_radio_stations selection
set radio_station_id = station.id,
    enabled = selection.is_active
from public.radio_stations station
where station.stream_url = selection.stream_url;

-- Consolidate legacy duplicate endpoints selected more than once by one church.
with grouped as (
  select church_id, radio_station_id,
    (array_agg(id order by is_featured desc, id::text))[1] as keep_id,
    bool_or(enabled) as enabled, bool_or(is_featured) as is_featured,
    min(sort_order) as sort_order
  from public.church_radio_stations
  group by church_id, radio_station_id
)
update public.church_radio_stations selection
set enabled = grouped.enabled,
    is_featured = grouped.is_featured,
    sort_order = grouped.sort_order
from grouped
where selection.id = grouped.keep_id;

with grouped as (
  select church_id, radio_station_id,
    (array_agg(id order by is_featured desc, id::text))[1] as keep_id
  from public.church_radio_stations
  group by church_id, radio_station_id
)
delete from public.church_radio_stations selection
using grouped
where selection.church_id = grouped.church_id
  and selection.radio_station_id = grouped.radio_station_id
  and selection.id <> grouped.keep_id;

alter table public.church_radio_stations
  alter column radio_station_id set not null,
  drop column name,
  drop column stream_url,
  drop column website_url,
  drop column logo_url,
  drop column description,
  drop column provider,
  drop column stream_format,
  drop column metadata_url,
  drop column is_active;

drop index if exists public.church_radio_stations_member_list_idx;
create unique index church_radio_stations_church_station_idx
  on public.church_radio_stations(church_id, radio_station_id);
create index church_radio_stations_member_list_idx
  on public.church_radio_stations(church_id, enabled, is_featured desc, sort_order);

alter table public.radio_stations enable row level security;

create policy "Super admins manage platform radio directory"
on public.radio_stations to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

create policy "Church managers read approved radio directory"
on public.radio_stations for select to authenticated
using (
  is_approved
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and public.has_church_feature_permission(auth.uid(), ur.church_id, 'radio', 'manage')
  )
);

create policy "Members read selected approved active radio stations"
on public.radio_stations for select to authenticated
using (
  is_active and is_approved
  and exists (
    select 1 from public.church_radio_stations selection
    where selection.radio_station_id = radio_stations.id
      and selection.enabled
      and public.has_church_feature_permission(auth.uid(), selection.church_id, 'radio', 'view')
  )
);

create policy "Authorized users read church radio selections"
on public.church_radio_stations for select to authenticated
using (
  public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage')
  or (enabled and public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'view'))
);

create policy "Church managers add approved own-church radio selections"
on public.church_radio_stations for insert to authenticated
with check (
  public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage')
  and exists (select 1 from public.radio_stations station where station.id = radio_station_id and station.is_approved)
);

create policy "Church managers update approved own-church radio selections"
on public.church_radio_stations for update to authenticated
using (public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage'))
with check (
  public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage')
  and exists (select 1 from public.radio_stations station where station.id = radio_station_id and station.is_approved)
);

create policy "Church managers remove own-church radio selections"
on public.church_radio_stations for delete to authenticated
using (public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage'));

grant select (
  id, name, stream_url, website_url, logo_url, description, provider,
  stream_format, is_active, is_approved, health_status,
  last_health_checked_at, created_at, updated_at
) on public.radio_stations to authenticated;
grant insert, update, delete on public.radio_stations to authenticated;

create or replace function public.get_platform_radio_stations()
returns setof public.radio_stations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not (
    public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid())
  ) then
    raise exception 'Platform Radio directory permission required' using errcode = '42501';
  end if;
  return query select * from public.radio_stations order by name;
end;
$$;

revoke all on function public.get_platform_radio_stations() from public, anon;
grant execute on function public.get_platform_radio_stations() to authenticated;

create or replace function public.set_church_radio_selection(
  _church_id uuid,
  _radio_station_id uuid,
  _enabled boolean,
  _is_featured boolean,
  _sort_order integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not public.has_church_feature_permission(
    auth.uid(), _church_id, 'radio', 'manage'
  ) then
    raise exception 'Radio management permission required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.radio_stations
    where id = _radio_station_id and is_approved
  ) then
    raise exception 'Only approved Radio stations may be selected' using errcode = '42501';
  end if;

  if _enabled and _is_featured then
    update public.church_radio_stations
    set is_featured = false, updated_at = now()
    where church_id = _church_id and is_featured;
  end if;

  insert into public.church_radio_stations (
    church_id, radio_station_id, enabled, is_featured, sort_order
  ) values (
    _church_id, _radio_station_id, _enabled, _enabled and _is_featured, greatest(_sort_order, 0)
  )
  on conflict (church_id, radio_station_id) do update set
    enabled = excluded.enabled,
    is_featured = excluded.is_featured,
    sort_order = excluded.sort_order,
    updated_at = now();
end;
$$;

revoke all on function public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer) from public, anon;
grant execute on function public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer) to authenticated;

comment on table public.radio_stations is
  'Platform-owned approved Radio directory. Stream bytes never transit Supabase.';
comment on table public.church_radio_stations is
  'Tenant selections from the platform Radio directory; contains no technical stream configuration.';
