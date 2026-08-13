-- Restore the historical notifications contract required by later active migrations.
-- The June 22 production-baseline cutover archived the original migration but omitted
-- public.notification_type and public.notifications from the replacement baseline.
-- This repair is additive, preserves existing rows, and fails closed on incompatible objects.

do $$
declare
  v_type_kind "char";
  v_labels text[];
begin
  if to_regtype('public.notification_type') is null then
    create type public.notification_type as enum ('info', 'warning', 'success', 'error');
  else
    select t.typtype,
           (select array_agg(e.enumlabel::text order by e.enumsortorder)
            from pg_enum e where e.enumtypid = t.oid)
      into v_type_kind, v_labels
    from pg_type t
    where t.oid = to_regtype('public.notification_type');

    if v_type_kind <> 'e' or v_labels is distinct from array['info', 'warning', 'success', 'error']::text[] then
      raise exception 'public.notification_type is incompatible; expected enum values (info, warning, success, error), found type kind % and values %',
        v_type_kind, v_labels;
    end if;
  end if;
end
$$;

do $$
declare
  v_relkind "char";
begin
  if to_regclass('public.notifications') is not null then
    select relkind into v_relkind from pg_class where oid = 'public.notifications'::regclass;
    if v_relkind <> 'r' then
      raise exception 'public.notifications is incompatible: expected an ordinary table, found relkind %', v_relkind;
    end if;
  end if;
end
$$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type public.notification_type not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Existing notification tables must already expose the historical columns. Adding
-- semantic fields such as title or message to unknown rows would require guessing.
do $$
declare
  v_column record;
  v_expected_types jsonb := jsonb_build_object(
    'id', 'uuid',
    'church_id', 'uuid',
    'user_id', 'uuid',
    'title', 'text',
    'message', 'text',
    'is_read', 'boolean',
    'created_at', 'timestamp with time zone'
  );
  v_name text;
begin
  foreach v_name in array array['id', 'church_id', 'user_id', 'title', 'message', 'type', 'is_read', 'created_at'] loop
    select c.data_type, c.udt_schema, c.udt_name
      into v_column
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'notifications'
      and c.column_name = v_name;

    if not found then
      raise exception 'public.notifications is incompatible: required column % is missing', v_name;
    end if;

    if v_name = 'type' then
      if not (
        (v_column.data_type = 'USER-DEFINED' and v_column.udt_schema = 'public' and v_column.udt_name = 'notification_type')
        or v_column.data_type in ('text', 'character varying')
      ) then
        raise exception 'public.notifications.type is incompatible: expected public.notification_type, text, or varchar; found %.%',
          v_column.udt_schema, v_column.udt_name;
      end if;
    elsif v_column.data_type is distinct from v_expected_types ->> v_name then
      raise exception 'public.notifications.% is incompatible: expected %, found %',
        v_name, v_expected_types ->> v_name, v_column.data_type;
    end if;
  end loop;

  if exists (
    select 1 from public.notifications
    where type is null or type::text not in ('info', 'warning', 'success', 'error')
  ) then
    raise exception 'public.notifications.type contains null or unexpected values; refusing enum conversion';
  end if;

  if exists (
    select 1 from public.notifications
    where id is null or title is null or message is null or is_read is null or created_at is null
  ) then
    raise exception 'public.notifications contains nulls in columns required by the historical contract';
  end if;
end
$$;

-- Text/varchar is the only supported legacy conversion. Values were validated above.
do $$
declare
  v_data_type text;
begin
  select c.data_type into v_data_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'notifications'
    and c.column_name = 'type';

  if v_data_type in ('text', 'character varying') then
    alter table public.notifications alter column type drop default;
    alter table public.notifications
      alter column type type public.notification_type
      using (type::text::public.notification_type);
  end if;
end
$$;

alter table public.notifications
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column title set not null,
  alter column message set not null,
  alter column type set default 'info'::public.notification_type,
  alter column type set not null,
  alter column is_read set default false,
  alter column is_read set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

-- Restore and verify the original primary-key and tenant/user foreign-key contract.
do $$
declare
  v_attnum smallint;
begin
  select attnum into v_attnum
  from pg_attribute
  where attrelid = 'public.notifications'::regclass and attname = 'id' and not attisdropped;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and contype = 'p'
      and conkey = array[v_attnum]::smallint[]
  ) then
    if exists (select 1 from pg_constraint where conrelid = 'public.notifications'::regclass and contype = 'p') then
      raise exception 'public.notifications has an incompatible primary key';
    end if;
    alter table public.notifications add constraint notifications_pkey primary key (id);
  end if;
end
$$;

do $$
declare
  v_constraint pg_constraint%rowtype;
  v_source_attnum smallint;
  v_target_attnum smallint;
begin
  select * into v_constraint from pg_constraint
  where conrelid = 'public.notifications'::regclass and conname = 'notifications_church_id_fkey';

  if not found then
    alter table public.notifications add constraint notifications_church_id_fkey
      foreign key (church_id) references public.churches(id) on delete cascade;
  else
    select attnum into v_source_attnum from pg_attribute
    where attrelid = 'public.notifications'::regclass and attname = 'church_id' and not attisdropped;
    select attnum into v_target_attnum from pg_attribute
    where attrelid = 'public.churches'::regclass and attname = 'id' and not attisdropped;
    if v_constraint.contype <> 'f'
       or v_constraint.conkey <> array[v_source_attnum]::smallint[]
       or v_constraint.confrelid <> 'public.churches'::regclass
       or v_constraint.confkey <> array[v_target_attnum]::smallint[]
       or v_constraint.confdeltype <> 'c' then
      raise exception 'notifications_church_id_fkey is incompatible: %', pg_get_constraintdef(v_constraint.oid);
    end if;
  end if;

  select * into v_constraint from pg_constraint
  where conrelid = 'public.notifications'::regclass and conname = 'notifications_user_id_fkey';

  if not found then
    alter table public.notifications add constraint notifications_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  else
    select attnum into v_source_attnum from pg_attribute
    where attrelid = 'public.notifications'::regclass and attname = 'user_id' and not attisdropped;
    select attnum into v_target_attnum from pg_attribute
    where attrelid = 'auth.users'::regclass and attname = 'id' and not attisdropped;
    if v_constraint.contype <> 'f'
       or v_constraint.conkey <> array[v_source_attnum]::smallint[]
       or v_constraint.confrelid <> 'auth.users'::regclass
       or v_constraint.confkey <> array[v_target_attnum]::smallint[]
       or v_constraint.confdeltype <> 'c' then
      raise exception 'notifications_user_id_fkey is incompatible: %', pg_get_constraintdef(v_constraint.oid);
    end if;
  end if;
end
$$;

do $$
declare
  v_index record;
  v_user_attnum smallint;
begin
  select i.indisunique, i.indisvalid, i.indkey::smallint[] as indkey,
         i.indpred, i.indexprs, am.amname
    into v_index
  from pg_class idx
  join pg_namespace n on n.oid = idx.relnamespace
  join pg_index i on i.indexrelid = idx.oid
  join pg_class tbl on tbl.oid = i.indrelid
  join pg_am am on am.oid = idx.relam
  where n.nspname = 'public'
    and idx.relname = 'idx_notifications_user'
    and tbl.oid = 'public.notifications'::regclass;

  if not found then
    create index idx_notifications_user on public.notifications (user_id);
  else
    select attnum into v_user_attnum from pg_attribute
    where attrelid = 'public.notifications'::regclass and attname = 'user_id' and not attisdropped;
    if v_index.indisunique
       or not v_index.indisvalid
       or v_index.indkey <> array[v_user_attnum]::smallint[]
       or v_index.indpred is not null
       or v_index.indexprs is not null
       or v_index.amname <> 'btree' then
      raise exception 'public.idx_notifications_user exists with an incompatible definition';
    end if;
  end if;
end
$$;

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
on public.notifications for select
using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update
using (auth.uid() = user_id);

drop policy if exists "Church admins can create notifications" on public.notifications;
create policy "Church admins can create notifications"
on public.notifications for insert
with check (church_id is null or public.is_church_admin(auth.uid(), church_id));

-- Authenticated users need only the operations admitted by the historical policies.
-- Trusted backend workers retain full table access; anonymous clients receive none.
revoke all on table public.notifications from public, anon, authenticated;
grant select, insert, update on table public.notifications to authenticated;
grant select, insert, update, delete on table public.notifications to service_role;
