-- Wave 5A: production-native, default-disabled tenant radio.

insert into public.platform_features (key, name, description, is_global, globally_enabled, globally_locked)
values ('radio', 'Radio', 'Approved live radio selected independently by each church.', true, true, false)
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.church_features (church_id, feature_id, enabled)
select c.id, f.id, false
from public.churches c cross join public.platform_features f
where f.key = 'radio'
on conflict (church_id, feature_id) do nothing;

insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_edit, can_delete, can_manage
)
select c.id, r.role, f.id,
  r.role in ('church_admin','member'),
  r.role = 'church_admin', r.role = 'church_admin',
  r.role = 'church_admin', r.role = 'church_admin'
from public.churches c
cross join (values ('church_admin'),('pastor'),('secretary'),('treasurer'),('member')) r(role)
cross join public.platform_features f
where f.key = 'radio'
on conflict (church_id, role, feature_id) do nothing;

create or replace function public.is_safe_radio_url(_url text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(
    _url ~* '^https://[^[:space:]@/?#]+(?::[0-9]+)?(?:[/?#].*)?$'
    and _url !~* '^https://(?:localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|\[?::1\]?)(?::|/|$)',
    false
  );
$$;

create table public.radio_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  stream_url text not null unique check (public.is_safe_radio_url(stream_url)),
  website_url text check (website_url is null or public.is_safe_radio_url(website_url)),
  logo_url text check (logo_url is null or public.is_safe_radio_url(logo_url)),
  description text check (description is null or length(description) <= 1000),
  is_active boolean not null default true,
  is_approved boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.church_radio_stations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  radio_station_id uuid not null references public.radio_stations(id) on delete restrict,
  enabled boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, radio_station_id)
);

create unique index church_radio_stations_one_default_idx
  on public.church_radio_stations(church_id) where enabled and is_default;
create index church_radio_stations_member_idx
  on public.church_radio_stations(church_id, enabled, is_default desc, sort_order);

create or replace function public.radio_feature_enabled(_church_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(bool_or(pf.globally_enabled and cf.enabled), false)
  from public.platform_features pf
  join public.church_features cf on cf.feature_id = pf.id
  where pf.key = 'radio' and cf.church_id = _church_id;
$$;

create or replace function public.has_radio_permission(_user_id uuid, _church_id uuid, _action text default 'view')
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.has_church_feature_permission(_user_id, _church_id, 'radio', _action);
$$;

alter table public.radio_stations enable row level security;
alter table public.church_radio_stations enable row level security;

create policy "Super admins manage radio directory"
on public.radio_stations to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

create policy "Authorized churches read usable radio directory"
on public.radio_stations for select to authenticated
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
on public.church_radio_stations for select to authenticated
using (
  public.has_radio_permission(auth.uid(), church_id, 'manage')
  or (enabled and public.has_radio_permission(auth.uid(), church_id, 'view'))
);

create or replace function public.set_church_radio_selection(
  _church_id uuid, _radio_station_id uuid, _enabled boolean,
  _is_default boolean default false, _sort_order integer default 0
)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.has_radio_permission(auth.uid(), _church_id, 'manage') then
    raise exception 'Radio management permission required' using errcode = '42501';
  end if;
  if _sort_order not between 0 and 10000 then raise exception 'Invalid station order' using errcode = '22023'; end if;
  if not exists (select 1 from public.radio_stations where id = _radio_station_id and is_active and is_approved) then
    raise exception 'Approved active station required' using errcode = '22023';
  end if;
  if _enabled and _is_default then
    update public.church_radio_stations set is_default = false, updated_at = clock_timestamp()
    where church_id = _church_id and is_default;
  end if;
  insert into public.church_radio_stations
    (church_id, radio_station_id, enabled, is_default, sort_order, created_by)
  values (_church_id, _radio_station_id, _enabled, _enabled and _is_default, _sort_order, auth.uid())
  on conflict (church_id, radio_station_id) do update
  set enabled = excluded.enabled, is_default = excluded.is_default,
      sort_order = excluded.sort_order, updated_at = clock_timestamp();
end;
$$;

revoke all on table public.radio_stations, public.church_radio_stations from public, anon, authenticated;
revoke all on function public.is_safe_radio_url(text), public.radio_feature_enabled(uuid),
  public.has_radio_permission(uuid,uuid,text), public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer)
  from public, anon, authenticated;
grant execute on function public.is_safe_radio_url(text), public.radio_feature_enabled(uuid), public.has_radio_permission(uuid,uuid,text),
  public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer) to authenticated;
grant select, insert, update, delete on public.radio_stations to authenticated;
grant select on public.church_radio_stations to authenticated;
