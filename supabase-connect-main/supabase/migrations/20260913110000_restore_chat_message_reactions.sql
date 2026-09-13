-- Restore chat reaction persistence after the production baseline omitted the
-- archived table contract. Policies use the current channel visibility helper.

begin;

create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_message_reactions'
      and column_name = 'message_id'
      and udt_name = 'uuid'
      and is_nullable = 'NO'
  ) then
    raise exception 'chat_message_reactions.message_id contract mismatch';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_message_reactions'
      and column_name = 'user_id'
      and udt_name = 'uuid'
      and is_nullable = 'NO'
  ) then
    raise exception 'chat_message_reactions.user_id contract mismatch';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_message_reactions'
      and column_name = 'emoji'
      and udt_name = 'text'
      and is_nullable = 'NO'
  ) then
    raise exception 'chat_message_reactions.emoji contract mismatch';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_message_reactions'
      and column_name = 'created_at'
      and udt_name = 'timestamptz'
      and is_nullable = 'NO'
      and column_default = 'now()'
  ) then
    raise exception 'chat_message_reactions.created_at contract mismatch';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'public'
      and table_row.relname = 'chat_message_reactions'
      and constraint_row.contype = 'p'
      and constraint_row.conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = table_row.oid
            and attname = 'message_id'
        ),
        (
          select attnum
          from pg_attribute
          where attrelid = table_row.oid
            and attname = 'user_id'
        )
      ]::smallint[]
  ) then
    raise exception 'chat_message_reactions primary key contract mismatch';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    join pg_class referenced_table on referenced_table.oid = constraint_row.confrelid
    join pg_namespace referenced_namespace on referenced_namespace.oid = referenced_table.relnamespace
    where namespace_row.nspname = 'public'
      and table_row.relname = 'chat_message_reactions'
      and constraint_row.contype = 'f'
      and referenced_namespace.nspname = 'public'
      and referenced_table.relname = 'chat_messages'
      and constraint_row.confdeltype = 'c'
  ) then
    raise exception 'chat_message_reactions.message_id foreign key contract mismatch';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    join pg_class referenced_table on referenced_table.oid = constraint_row.confrelid
    join pg_namespace referenced_namespace on referenced_namespace.oid = referenced_table.relnamespace
    where namespace_row.nspname = 'public'
      and table_row.relname = 'chat_message_reactions'
      and constraint_row.contype = 'f'
      and referenced_namespace.nspname = 'auth'
      and referenced_table.relname = 'users'
      and constraint_row.confdeltype = 'c'
  ) then
    raise exception 'chat_message_reactions.user_id foreign key contract mismatch';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'public'
      and table_row.relname = 'chat_message_reactions'
      and constraint_row.contype = 'c'
      and regexp_replace(
        lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid)),
        '[[:space:]()]+',
        '',
        'g'
      ) = 'char_lengthemoji>=1andchar_lengthemoji<=16'
  ) then
    raise exception 'chat_message_reactions.emoji check constraint contract mismatch';
  end if;
end;
$$;

create index if not exists idx_chat_message_reactions_message_id
  on public.chat_message_reactions(message_id, created_at);

alter table public.chat_message_reactions enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_message_reactions'
  loop
    execute format(
      'drop policy if exists %I on public.chat_message_reactions',
      policy_record.policyname
    );
  end loop;
end;
$$;

create policy "Users can view chat reactions"
on public.chat_message_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_messages message_row
    where message_row.id = chat_message_reactions.message_id
      and public.can_view_chat_channel(message_row.channel_id)
  )
);

create policy "Users can add chat reactions"
on public.chat_message_reactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.chat_messages message_row
    where message_row.id = chat_message_reactions.message_id
      and public.can_view_chat_channel(message_row.channel_id)
  )
);

create policy "Users can update chat reactions"
on public.chat_message_reactions
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.chat_messages message_row
    where message_row.id = chat_message_reactions.message_id
      and public.can_view_chat_channel(message_row.channel_id)
  )
);

create policy "Users can delete their chat reactions"
on public.chat_message_reactions
for delete
to authenticated
using (
  user_id = auth.uid()
);

revoke all on public.chat_message_reactions from anon;
grant select, insert, update, delete on public.chat_message_reactions to authenticated;

commit;
