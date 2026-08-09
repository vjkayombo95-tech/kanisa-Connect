-- Phase 1: additive foundation for canonical multi-church memberships.
--
-- This migration intentionally does not backfill data, change existing
-- authorization helpers, or expose memberships to end users. Only an active
-- membership will grant tenant access after a separately approved cutover.

-- ---------------------------------------------------------------------------
-- Membership status type
-- ---------------------------------------------------------------------------

do $$
declare
  v_type_kind "char";
  v_labels text[];
begin
  select t.typtype
    into v_type_kind
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'church_membership_status';

  if not found then
    create type public.church_membership_status as enum (
      'pending',
      'active',
      'suspended',
      'revoked',
      'left'
    );
  elsif v_type_kind <> 'e' then
    raise exception 'public.church_membership_status exists but is not an enum';
  else
    select pg_catalog.array_agg(e.enumlabel::text order by e.enumsortorder)
      into v_labels
    from pg_catalog.pg_enum e
    join pg_catalog.pg_type t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'church_membership_status';

    if v_labels is distinct from array[
      'pending', 'active', 'suspended', 'revoked', 'left'
    ]::text[] then
      raise exception
        'public.church_membership_status has incompatible labels: %',
        v_labels;
    end if;
  end if;
end;
$$;

comment on type public.church_membership_status is
  'Lifecycle state for a canonical user/church membership. Only active memberships may grant future tenant access.';

-- ---------------------------------------------------------------------------
-- Canonical membership table and constraints
-- ---------------------------------------------------------------------------

create table public.church_memberships (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  church_id uuid not null,
  status public.church_membership_status not null default 'pending',
  joined_at timestamptz not null default now(),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  invited_by uuid,
  membership_source text,
  constraint church_memberships_pkey primary key (id),
  constraint church_memberships_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict,
  constraint church_memberships_church_id_fkey
    foreign key (church_id) references public.churches(id) on delete restrict,
  constraint church_memberships_invited_by_fkey
    foreign key (invited_by) references auth.users(id) on delete set null,
  constraint church_memberships_user_church_key unique (user_id, church_id),
  constraint church_memberships_primary_active_check
    check (not is_primary or status = 'active')
);

comment on table public.church_memberships is
  'Canonical relationship between an authenticated user and a church. Browser workspace selection remains a separate, untrusted client context.';
comment on column public.church_memberships.is_primary is
  'Durable default membership only; this is not the active browser workspace.';
comment on column public.church_memberships.status is
  'Only active memberships may grant tenant access after the future authorization cutover.';
comment on column public.church_memberships.membership_source is
  'Auditable provenance for a future backfill or membership creation workflow.';

-- ---------------------------------------------------------------------------
-- Membership indexes
-- ---------------------------------------------------------------------------

create unique index church_memberships_one_active_primary_user_idx
  on public.church_memberships (user_id)
  where is_primary and status = 'active';

create index church_memberships_user_status_idx
  on public.church_memberships (user_id, status);

create index church_memberships_church_status_idx
  on public.church_memberships (church_id, status);

create index church_memberships_church_user_status_idx
  on public.church_memberships (church_id, user_id, status);

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------

create trigger set_church_memberships_updated_at
before update on public.church_memberships
for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Transitional nullable references. No values are backfilled in Phase 1.
-- ---------------------------------------------------------------------------

alter table public.members
  add column membership_id uuid;

alter table public.members
  add constraint members_membership_id_fkey
  foreign key (membership_id)
  references public.church_memberships(id)
  on delete restrict;

create index members_membership_id_idx
  on public.members (membership_id);

comment on column public.members.membership_id is
  'Transitional link to the canonical church membership; nullable until an approved backfill.';

alter table public.user_roles
  add column membership_id uuid;

alter table public.user_roles
  add constraint user_roles_membership_id_fkey
  foreign key (membership_id)
  references public.church_memberships(id)
  on delete restrict;

create index user_roles_membership_id_idx
  on public.user_roles (membership_id);

comment on column public.user_roles.membership_id is
  'Transitional membership scope for roles; nullable until an approved backfill.';

-- ---------------------------------------------------------------------------
-- Future membership-aware helpers. Existing authorization does not call these.
-- The distinct canonical name is intentional: the existing
-- public.is_active_church_member(uuid, uuid) remains part of the legacy audio
-- authorization path and must not be replaced during this additive phase.
-- ---------------------------------------------------------------------------

create function public.has_active_canonical_church_membership(
  _user_id uuid,
  _church_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    _user_id is not null
    and _church_id is not null
    and exists (
      select 1
      from public.church_memberships cm
      where cm.user_id = _user_id
        and cm.church_id = _church_id
        and cm.status = 'active'
    );
$$;

comment on function public.has_active_canonical_church_membership(uuid, uuid) is
  'Future authorization primitive. It is not wired into existing policies or permission helpers in Phase 1.';

create function public.current_user_has_active_church_membership(
  _church_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.has_active_canonical_church_membership(
    (select auth.uid()),
    _church_id
  );
$$;

comment on function public.current_user_has_active_church_membership(uuid) is
  'Future caller-bound active-membership check. It is not exposed to end users in Phase 1.';

-- ---------------------------------------------------------------------------
-- Deny-by-default RLS and explicit privileges
-- ---------------------------------------------------------------------------

alter table public.church_memberships enable row level security;

revoke all on type public.church_membership_status from public, anon, authenticated;
grant usage on type public.church_membership_status to service_role;

revoke all on table public.church_memberships from public, anon, authenticated;
grant select, insert, update, delete on table public.church_memberships to service_role;

revoke all on function public.has_active_canonical_church_membership(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.current_user_has_active_church_membership(uuid)
  from public, anon, authenticated;

grant execute on function public.has_active_canonical_church_membership(uuid, uuid)
  to service_role;
grant execute on function public.current_user_has_active_church_membership(uuid)
  to service_role;
