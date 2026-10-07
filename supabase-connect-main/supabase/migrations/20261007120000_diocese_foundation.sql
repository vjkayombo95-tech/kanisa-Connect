-- Diocese foundation and authorization boundary.
--
-- This migration is intentionally additive. Diocese staff are independent from
-- church members, church staff, and church roles; no existing church
-- authorization helper is modified here.

-- ---------------------------------------------------------------------------
-- Diocese tables
-- ---------------------------------------------------------------------------

create table public.dioceses (
  id uuid not null default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  logo_url text,
  cover_photo_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  constraint dioceses_pkey primary key (id),
  constraint dioceses_slug_key unique (slug),
  constraint dioceses_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  constraint dioceses_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null,
  constraint dioceses_name_not_blank_check check (length(trim(name)) > 0),
  constraint dioceses_slug_format_check
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint dioceses_status_check
    check (status in ('active', 'inactive', 'archived'))
);

comment on table public.dioceses is
  'Diocese-level organization. A diocese is not a church tenant and does not grant church workspace authority.';

create index dioceses_status_idx
  on public.dioceses (status);

create index dioceses_created_by_idx
  on public.dioceses (created_by);

create table public.diocese_churches (
  id uuid not null default gen_random_uuid(),
  diocese_id uuid not null,
  church_id uuid not null,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  added_by uuid default auth.uid(),
  constraint diocese_churches_pkey primary key (id),
  constraint diocese_churches_diocese_id_fkey
    foreign key (diocese_id) references public.dioceses(id) on delete cascade,
  constraint diocese_churches_church_id_fkey
    foreign key (church_id) references public.churches(id) on delete restrict,
  constraint diocese_churches_added_by_fkey
    foreign key (added_by) references auth.users(id) on delete set null,
  constraint diocese_churches_status_check
    check (status in ('active', 'inactive', 'ended')),
  constraint diocese_churches_active_ended_at_check
    check ((status = 'active' and ended_at is null) or status <> 'active'),
  constraint diocese_churches_ended_at_after_joined_at_check
    check (ended_at is null or ended_at >= joined_at)
);

comment on table public.diocese_churches is
  'Relationship between a diocese and a church. A church may have only one active diocese assignment.';

create unique index diocese_churches_one_active_diocese_per_church_idx
  on public.diocese_churches (church_id)
  where status = 'active';

create index diocese_churches_diocese_status_idx
  on public.diocese_churches (diocese_id, status);

create index diocese_churches_church_status_idx
  on public.diocese_churches (church_id, status);

create index diocese_churches_added_by_idx
  on public.diocese_churches (added_by);

create table public.diocese_staff (
  id uuid not null default gen_random_uuid(),
  diocese_id uuid not null,
  user_id uuid not null,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diocese_staff_pkey primary key (id),
  constraint diocese_staff_diocese_id_fkey
    foreign key (diocese_id) references public.dioceses(id) on delete cascade,
  constraint diocese_staff_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict,
  constraint diocese_staff_diocese_user_key unique (diocese_id, user_id),
  constraint diocese_staff_role_check
    check (role in (
      'diocese_admin',
      'bishop',
      'diocese_secretary',
      'diocese_finance',
      'diocese_staff'
    )),
  constraint diocese_staff_status_check
    check (status in ('active', 'inactive', 'suspended', 'revoked'))
);

comment on table public.diocese_staff is
  'Diocese-level staff membership. This does not imply church membership, parish roles, or church admin authority.';

create index diocese_staff_user_status_idx
  on public.diocese_staff (user_id, status);

create index diocese_staff_diocese_status_idx
  on public.diocese_staff (diocese_id, status);

create index diocese_staff_diocese_role_status_idx
  on public.diocese_staff (diocese_id, role, status);

create trigger set_dioceses_updated_at
before update on public.dioceses
for each row execute function public.update_updated_at_column();

create trigger set_diocese_staff_updated_at
before update on public.diocese_staff
for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Diocese-specific authorization helpers
-- ---------------------------------------------------------------------------

create function public.is_diocese_staff(
  _user_id uuid,
  _diocese_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select _user_id is not null
    and _diocese_id is not null
    and exists (
      select 1
      from public.diocese_staff ds
      where ds.user_id = _user_id
        and ds.diocese_id = _diocese_id
        and ds.status = 'active'
    );
$$;

comment on function public.is_diocese_staff(uuid, uuid) is
  'Returns true only for active Diocese staff membership. It does not inspect church membership or church roles.';

create function public.current_user_can_view_diocese(
  _diocese_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and _diocese_id is not null
    and (
      public.is_platform_super_admin(auth.uid())
      or public.is_super_admin(auth.uid())
      or public.is_diocese_staff(auth.uid(), _diocese_id)
    );
$$;

comment on function public.current_user_can_view_diocese(uuid) is
  'Caller-bound Diocese read helper. Diocese access is separate from church workspace authorization.';

create function public.current_user_can_manage_diocese(
  _diocese_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and _diocese_id is not null
    and (
      public.is_platform_super_admin(auth.uid())
      or public.is_super_admin(auth.uid())
      or exists (
        select 1
        from public.diocese_staff ds
        where ds.user_id = auth.uid()
          and ds.diocese_id = _diocese_id
          and ds.status = 'active'
          and ds.role in ('diocese_admin', 'bishop')
      )
    );
$$;

comment on function public.current_user_can_manage_diocese(uuid) is
  'Caller-bound Diocese management helper. It grants no church workspace authority.';

-- Supabase migrations run as the database owner. Keep ownership explicit for
-- SECURITY DEFINER helpers.
alter function public.is_diocese_staff(uuid, uuid) owner to postgres;
alter function public.current_user_can_view_diocese(uuid) owner to postgres;
alter function public.current_user_can_manage_diocese(uuid) owner to postgres;

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------

alter table public.dioceses enable row level security;
alter table public.diocese_churches enable row level security;
alter table public.diocese_staff enable row level security;

create policy "Authorized Diocese users can read dioceses"
on public.dioceses
for select
to authenticated
using (public.current_user_can_view_diocese(id));

create policy "Super admins can create dioceses"
on public.dioceses
for insert
to authenticated
with check (
  public.is_platform_super_admin(auth.uid())
  or public.is_super_admin(auth.uid())
);

create policy "Diocese managers can update dioceses"
on public.dioceses
for update
to authenticated
using (public.current_user_can_manage_diocese(id))
with check (public.current_user_can_manage_diocese(id));

create policy "Super admins can delete dioceses"
on public.dioceses
for delete
to authenticated
using (
  public.is_platform_super_admin(auth.uid())
  or public.is_super_admin(auth.uid())
);

create policy "Authorized Diocese users can read Diocese church links"
on public.diocese_churches
for select
to authenticated
using (public.current_user_can_view_diocese(diocese_id));

create policy "Diocese managers can create Diocese church links"
on public.diocese_churches
for insert
to authenticated
with check (public.current_user_can_manage_diocese(diocese_id));

create policy "Diocese managers can update Diocese church links"
on public.diocese_churches
for update
to authenticated
using (public.current_user_can_manage_diocese(diocese_id))
with check (public.current_user_can_manage_diocese(diocese_id));

create policy "Diocese managers can delete Diocese church links"
on public.diocese_churches
for delete
to authenticated
using (public.current_user_can_manage_diocese(diocese_id));

create policy "Authorized Diocese users can read Diocese staff"
on public.diocese_staff
for select
to authenticated
using (public.current_user_can_view_diocese(diocese_id));

create policy "Diocese managers can create Diocese staff"
on public.diocese_staff
for insert
to authenticated
with check (public.current_user_can_manage_diocese(diocese_id));

create policy "Diocese managers can update Diocese staff"
on public.diocese_staff
for update
to authenticated
using (public.current_user_can_manage_diocese(diocese_id))
with check (public.current_user_can_manage_diocese(diocese_id));

create policy "Diocese managers can delete Diocese staff"
on public.diocese_staff
for delete
to authenticated
using (public.current_user_can_manage_diocese(diocese_id));

revoke all on table public.dioceses from public, anon, authenticated;
revoke all on table public.diocese_churches from public, anon, authenticated;
revoke all on table public.diocese_staff from public, anon, authenticated;

grant select, insert, update, delete on table public.dioceses to authenticated;
grant select, insert, update, delete on table public.diocese_churches to authenticated;
grant select, insert, update, delete on table public.diocese_staff to authenticated;

grant select, insert, update, delete on table public.dioceses to service_role;
grant select, insert, update, delete on table public.diocese_churches to service_role;
grant select, insert, update, delete on table public.diocese_staff to service_role;

revoke all on function public.is_diocese_staff(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.current_user_can_view_diocese(uuid)
  from public, anon, authenticated;
revoke all on function public.current_user_can_manage_diocese(uuid)
  from public, anon, authenticated;

grant execute on function public.is_diocese_staff(uuid, uuid)
  to service_role;
grant execute on function public.current_user_can_view_diocese(uuid)
  to authenticated, service_role;
grant execute on function public.current_user_can_manage_diocese(uuid)
  to authenticated, service_role;
