-- Align live billing with the subscriptions table consumed by the current app.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'basic', 'intermediate', 'pro', 'enterprise')),
  status text not null default 'active'
    check (status in ('active', 'trial', 'expired')),
  started_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  addon_name text not null check (addon_name in ('member_portal')),
  purchased boolean not null default false,
  purchased_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (church_id, addon_name)
);

create table if not exists public.trial_extensions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  extended_by uuid not null references auth.users(id) on delete cascade,
  days_added integer not null check (days_added > 0),
  created_at timestamp with time zone not null default now()
);

create unique index if not exists subscriptions_one_current_per_church_idx
  on public.subscriptions (church_id)
  where status in ('active', 'trial');

create index if not exists subscriptions_church_status_idx
  on public.subscriptions (church_id, status);

create index if not exists trial_extensions_church_idx
  on public.trial_extensions (church_id, created_at desc);

create or replace function public.is_platform_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and exists (
      select 1
      from public.super_admins sa
      where sa.id = _user_id
    );
$$;

create or replace function public.can_view_church_billing(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and _church_id is not null
    and (
      public.is_platform_super_admin(_user_id)
      or public.can_manage_church_workspace(_user_id, _church_id)
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.church_id = _church_id
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = _user_id
          and p.church_id = _church_id
      )
      or exists (
        select 1
        from public.members m
        where m.user_id = _user_id
          and m.church_id = _church_id
      )
    );
$$;

revoke all on function public.is_platform_super_admin(uuid) from public;
revoke all on function public.can_view_church_billing(uuid, uuid) from public;
grant execute on function public.is_platform_super_admin(uuid) to authenticated;
grant execute on function public.can_view_church_billing(uuid, uuid) to authenticated;

alter table public.subscriptions enable row level security;
drop policy if exists "Church workspace users can view subscriptions" on public.subscriptions;
drop policy if exists "Workspace managers can manage subscriptions" on public.subscriptions;
create policy "Church workspace users can view subscriptions"
on public.subscriptions
for select
to authenticated
using (public.can_view_church_billing(auth.uid(), church_id));
create policy "Workspace managers can manage subscriptions"
on public.subscriptions
for all
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

alter table public.addons enable row level security;
drop policy if exists "Church workspace users can view addons" on public.addons;
drop policy if exists "Workspace managers can manage addons" on public.addons;
create policy "Church workspace users can view addons"
on public.addons
for select
to authenticated
using (public.can_view_church_billing(auth.uid(), church_id));
create policy "Workspace managers can manage addons"
on public.addons
for all
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

alter table public.trial_extensions enable row level security;
drop policy if exists "Super admins can manage trial extensions" on public.trial_extensions;
create policy "Super admins can manage trial extensions"
on public.trial_extensions
for all
to authenticated
using (public.is_platform_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()));

create or replace function public.set_billing_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_subscriptions_updated_at_before_write on public.subscriptions;
create trigger set_subscriptions_updated_at_before_write
before update on public.subscriptions
for each row execute function public.set_billing_updated_at();

drop trigger if exists set_addons_updated_at_before_write on public.addons;
create trigger set_addons_updated_at_before_write
before update on public.addons
for each row execute function public.set_billing_updated_at();

create or replace function public.ensure_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _trial_days integer := 7;
begin
  if to_regclass('public.platform_settings') is not null then
    select coalesce(default_trial_days, 7)
    into _trial_days
    from public.platform_settings
    order by created_at
    limit 1;
  end if;

  insert into public.subscriptions (church_id, plan, status, started_at, expires_at)
  select new.id, 'pro', 'trial', now(), now() + make_interval(days => greatest(coalesce(_trial_days, 7), 1))
  where not exists (
    select 1
    from public.subscriptions s
    where s.church_id = new.id
      and s.status in ('active', 'trial')
  );

  return new;
end;
$$;

drop trigger if exists create_default_subscription_for_church on public.churches;
create trigger create_default_subscription_for_church
after insert on public.churches
for each row execute function public.ensure_default_subscription();

-- Existing workspaces, including St Paul, begin on a current active Free plan.
insert into public.subscriptions (church_id, plan, status, started_at)
select c.id, 'free', 'active', now()
from public.churches c
where not exists (
  select 1
  from public.subscriptions s
  where s.church_id = c.id
    and s.status in ('active', 'trial')
);

create or replace function public.extend_trial(_church_id uuid, _days integer)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  _subscription public.subscriptions%rowtype;
begin
  if not public.is_platform_super_admin(auth.uid()) then
    raise exception 'Only super admins can extend trials';
  end if;

  if _days is null or _days <= 0 then
    raise exception 'Days must be greater than zero';
  end if;

  select s.* into _subscription
  from public.subscriptions s
  where s.church_id = _church_id
    and s.status in ('active', 'trial')
  order by s.started_at desc
  limit 1;

  if _subscription.id is null then
    raise exception 'No active or trial subscription found for church %', _church_id;
  end if;

  update public.subscriptions
  set status = 'trial',
      expires_at = greatest(coalesce(_subscription.expires_at, now()), now()) + make_interval(days => _days)
  where id = _subscription.id
  returning * into _subscription;

  insert into public.trial_extensions (church_id, extended_by, days_added)
  values (_church_id, auth.uid(), _days);

  return _subscription;
end;
$$;

revoke all on function public.extend_trial(uuid, integer) from public;
grant execute on function public.extend_trial(uuid, integer) to authenticated;
