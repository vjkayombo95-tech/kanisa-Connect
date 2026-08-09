-- Additive, tenant-scoped configuration for direct-to-browser live radio.

insert into public.platform_features (
  key, name, description, is_global, globally_enabled, globally_locked,
  category, member_available, staff_available, available_plans
)
values (
  'radio', 'Radio Live', 'Configure live internet radio stations for church members.',
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
join public.platform_features pf on pf.key = 'radio'
on conflict (church_id, feature_id) do nothing;

insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
  can_approve, can_publish, can_manage
)
select c.id, role_name, pf.id, true,
  role_name = 'church_admin', role_name = 'church_admin', role_name = 'church_admin',
  false, false, role_name = 'church_admin'
from public.churches c
join public.platform_features pf on pf.key = 'radio'
cross join unnest(array['church_admin','member']) role_name
on conflict (church_id, role, feature_id) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete,
  can_approve = excluded.can_approve,
  can_publish = excluded.can_publish,
  can_manage = excluded.can_manage;

-- Extend the canonical constraint function without copying a historical body.
do $$
declare
  v_definition text;
  v_extended text;
begin
  select pg_get_functiondef('public.church_permission_constraint_rule(text,text,text)'::regprocedure)
  into v_definition;
  v_extended := replace(v_definition, '''livestream''', '''livestream'',''radio''');
  if v_extended = v_definition then
    raise exception 'Canonical permission model did not contain livestream extension points';
  end if;
  execute v_extended;
end;
$$;

create or replace function public.is_safe_public_https_url(_value text)
returns boolean language sql immutable strict set search_path = pg_catalog as $$
  select _value ~* '^https://[^/?#@[:space:]]+([/?#]|$)'
    and _value !~* '^https://(localhost|127\.[0-9.]+|0\.[0-9.]+|10\.[0-9.]+|192\.168\.[0-9.]+|169\.254\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|\[?::1\]?|\[?(fc|fd|fe8)[0-9a-f:]*\]?)([:/?#]|$)';
$$;

create table public.church_radio_stations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  stream_url text not null check (public.is_safe_public_https_url(stream_url)),
  website_url text check (website_url is null or public.is_safe_public_https_url(website_url)),
  logo_url text check (logo_url is null or public.is_safe_public_https_url(logo_url)),
  description text check (description is null or length(description) <= 500),
  provider text,
  stream_format text,
  metadata_url text check (metadata_url is null or public.is_safe_public_https_url(metadata_url)),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index church_radio_stations_one_featured_idx
  on public.church_radio_stations(church_id) where is_featured;
create index church_radio_stations_member_list_idx
  on public.church_radio_stations(church_id, is_active, is_featured desc, sort_order, name);

create trigger touch_church_radio_stations
before update on public.church_radio_stations
for each row execute function public.update_updated_at_column();

alter table public.church_radio_stations enable row level security;

create policy "Members read active church radio stations"
on public.church_radio_stations for select to authenticated
using (
  is_active
  and public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'view')
);

create policy "Church admins read all own radio stations"
on public.church_radio_stations for select to authenticated
using (public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage'));

create policy "Church admins create own radio stations"
on public.church_radio_stations for insert to authenticated
with check (public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage'));

create policy "Church admins update own radio stations"
on public.church_radio_stations for update to authenticated
using (public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage'))
with check (public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage'));

create policy "Church admins delete own radio stations"
on public.church_radio_stations for delete to authenticated
using (public.has_church_feature_permission(auth.uid(), church_id, 'radio', 'manage'));

grant select, insert, update, delete on public.church_radio_stations to authenticated;
revoke all on function public.is_safe_public_https_url(text) from public, anon;
grant execute on function public.is_safe_public_https_url(text) to authenticated;

comment on table public.church_radio_stations is
  'Church-configured radio metadata only; audio bytes flow directly from provider to member browser.';
