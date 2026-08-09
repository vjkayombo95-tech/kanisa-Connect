\set ON_ERROR_STOP on
begin;

select '1..7';

do $$ begin assert to_regclass('public.church_livestreams') is not null, 'livestream table exists'; end $$;
select 'ok 1 - livestream table exists';
do $$ begin assert (select relrowsecurity from pg_class where oid = 'public.church_livestreams'::regclass), 'RLS is enabled'; end $$;
select 'ok 2 - RLS is enabled';
do $$ begin assert exists (select 1 from pg_indexes where schemaname='public' and indexname='church_livestreams_one_live_per_church_idx' and indexdef ilike '%status = ''live''%'), 'one-live index exists'; end $$;
select 'ok 3 - one-live partial unique index exists';
do $$ begin assert exists (select 1 from pg_trigger where tgrelid='public.church_livestreams'::regclass and tgname='enforce_church_livestream_lifecycle_trigger' and not tgisinternal), 'lifecycle trigger exists'; end $$;
select 'ok 4 - lifecycle trigger exists';
do $$ begin assert exists (select 1 from pg_policies where schemaname='public' and tablename='church_livestreams' and cmd='SELECT'), 'read policy exists'; end $$;
select 'ok 5 - tenant read policy exists';
do $$ begin assert exists (select 1 from pg_policies where schemaname='public' and tablename='church_livestreams' and cmd='INSERT'), 'create policy exists'; end $$;
select 'ok 6 - staff create policy exists';
do $$ begin assert to_regprocedure('public.transition_church_livestream(uuid,text)') is not null, 'transition RPC exists'; end $$;
select 'ok 7 - authorized transition RPC exists';

rollback;
