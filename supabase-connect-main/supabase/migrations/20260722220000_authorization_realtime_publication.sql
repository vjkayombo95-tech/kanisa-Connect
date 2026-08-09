-- Forward-only support for authorization cache synchronization.
-- FULL replica identity preserves tenant/user keys in DELETE payloads so
-- clients can reject events from the wrong authorization scope.
alter table public.user_roles replica identity full;
alter table public.members replica identity full;
alter table public.profiles replica identity full;
alter table public.church_role_permissions replica identity full;
alter table public.church_features replica identity full;
alter table public.subscriptions replica identity full;
alter table public.platform_features replica identity full;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'user_roles',
    'members',
    'profiles',
    'church_role_permissions',
    'church_features',
    'subscriptions',
    'platform_features'
  ] loop
    if not exists (
      select 1
      from pg_catalog.pg_publication p
      join pg_catalog.pg_publication_rel pr on pr.prpubid = p.oid
      join pg_catalog.pg_class c on c.oid = pr.prrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
