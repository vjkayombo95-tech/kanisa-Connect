-- Postgres Changes cannot safely filter DELETE events under RLS. Emit minimal,
-- private, topic-scoped Broadcast signals instead; clients always refetch the
-- authoritative RPC/table and never apply message data as authorization.
create or replace function public.broadcast_authorization_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, realtime
as $$
declare
  v_row jsonb;
  v_user_id text;
  v_church_id text;
  v_topic text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_table_name in ('user_roles', 'members') then
    v_user_id := nullif(v_row->>'user_id', '');
    if v_user_id is not null then v_topic := 'authorization:user:' || v_user_id; end if;
  elsif tg_table_name = 'profiles' then
    v_user_id := nullif(v_row->>'id', '');
    if v_user_id is not null then v_topic := 'authorization:user:' || v_user_id; end if;
  elsif tg_table_name in ('church_role_permissions', 'church_features', 'subscriptions') then
    v_church_id := nullif(v_row->>'church_id', '');
    if v_church_id is not null then v_topic := 'authorization:church:' || v_church_id; end if;
  elsif tg_table_name = 'platform_features' then
    v_topic := 'authorization:platform';
  end if;

  if v_topic is not null then
    perform realtime.send(
      jsonb_build_object('source', tg_table_name, 'operation', tg_op),
      'authorization_changed',
      v_topic,
      true
    );
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.broadcast_authorization_change() from public, anon, authenticated;

-- The preceding migration made DELETE payloads inspectable for an initial
-- Postgres Changes implementation. Broadcast makes that unnecessary. Restore
-- default replica identity and keep only the three pre-existing publication
-- tables so unrelated profile/member/subscription writes are not decoded.
alter table public.user_roles replica identity default;
alter table public.members replica identity default;
alter table public.profiles replica identity default;
alter table public.church_role_permissions replica identity default;
alter table public.church_features replica identity default;
alter table public.subscriptions replica identity default;
alter table public.platform_features replica identity default;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['members', 'profiles', 'subscriptions', 'platform_features'] loop
    if exists (
      select 1
      from pg_catalog.pg_publication p
      join pg_catalog.pg_publication_rel pr on pr.prpubid = p.oid
      join pg_catalog.pg_class c on c.oid = pr.prrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = v_table
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', v_table);
    end if;
  end loop;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'user_roles', 'members', 'profiles', 'church_role_permissions',
    'church_features', 'subscriptions', 'platform_features'
  ] loop
    execute format('drop trigger if exists broadcast_authorization_change on public.%I', v_table);
    execute format(
      'create trigger broadcast_authorization_change after insert or update or delete on public.%I for each row execute function public.broadcast_authorization_change()',
      v_table
    );
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Scoped authorization broadcasts'
  ) then
    create policy "Scoped authorization broadcasts"
    on realtime.messages
    for select
    to authenticated
    using (
      realtime.messages.extension = 'broadcast'
      and (
        (select realtime.topic()) = 'authorization:user:' || (select auth.uid())::text
        or (select realtime.topic()) = 'authorization:platform'
        or (
          (select realtime.topic()) ~ '^authorization:church:[0-9a-f-]{36}$'
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.church_id = split_part((select realtime.topic()), ':', 3)::uuid
            union all
            select 1 from public.members m
            where m.user_id = (select auth.uid())
              and m.church_id = split_part((select realtime.topic()), ':', 3)::uuid
              and coalesce(m.status, 'active') = 'active'
          )
        )
      )
    );
  end if;
end;
$$;
