-- Phase 4.3 repair: align older audit_logs tables with the current schema.

alter table public.audit_logs
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists actor_role text,
  add column if not exists entity_type text,
  add column if not exists description text,
  add column if not exists metadata jsonb not null default '{}',
  add column if not exists ip_address text;

alter table public.audit_logs
  alter column metadata set default '{}';

update public.audit_logs
set metadata = '{}'
where metadata is null;

alter table public.audit_logs
  alter column metadata set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and column_name = 'user_id'
  ) then
    execute 'update public.audit_logs set actor_id = user_id where actor_id is null';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and column_name = 'entity'
  ) then
    execute 'update public.audit_logs set entity_type = entity where entity_type is null';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and column_name = 'details'
  ) then
    execute 'update public.audit_logs set description = details where description is null';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and column_name = 'created_at'
      and data_type <> 'timestamp with time zone'
  ) then
    alter table public.audit_logs
      alter column created_at type timestamptz
      using created_at::timestamptz;
  end if;
end $$;

alter table public.audit_logs enable row level security;

drop policy if exists "Super admins can view audit logs" on public.audit_logs;

create policy "Super admins can view audit logs"
on public.audit_logs
for select
to authenticated
using (public.is_super_admin());

grant select
on public.audit_logs
to authenticated;

create index if not exists audit_logs_created_at_idx
on public.audit_logs (created_at desc);

create index if not exists audit_logs_actor_id_idx
on public.audit_logs (actor_id);

create index if not exists audit_logs_entity_type_idx
on public.audit_logs (entity_type);

create index if not exists audit_logs_action_idx
on public.audit_logs (action);
