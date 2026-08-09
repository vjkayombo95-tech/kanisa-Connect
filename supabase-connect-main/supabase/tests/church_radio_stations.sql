\set ON_ERROR_STOP on
begin;

select '1..8';
do $$ begin assert to_regclass('public.church_radio_stations') is not null; end $$;
select 'ok 1 - radio station table exists';
do $$ begin assert (select relrowsecurity from pg_class where oid='public.church_radio_stations'::regclass); end $$;
select 'ok 2 - RLS is enabled';
do $$ begin assert exists(select 1 from pg_policies where tablename='church_radio_stations' and cmd='SELECT' and qual ilike '%is_active%'); end $$;
select 'ok 3 - member reads require active station';
do $$ begin assert exists(select 1 from pg_policies where tablename='church_radio_stations' and cmd='SELECT' and qual ilike '%has_church_feature_permission%'); end $$;
select 'ok 4 - member reads require tenant feature permission';
do $$ begin assert exists(select 1 from pg_policies where tablename='church_radio_stations' and cmd='INSERT' and with_check ilike '%radio%manage%'); end $$;
select 'ok 5 - admin insert requires radio manage';
do $$ begin assert exists(select 1 from pg_policies where tablename='church_radio_stations' and cmd='UPDATE' and qual ilike '%radio%manage%'); end $$;
select 'ok 6 - admin update requires radio manage';
do $$ begin assert public.is_safe_public_https_url('https://example.com/live') and not public.is_safe_public_https_url('https://127.0.0.1/live'); end $$;
select 'ok 7 - public HTTPS validator rejects loopback';
do $$ begin assert (public.church_permission_constraint_rule('church_admin','radio','manage')->>'classification')='CONFIGURABLE'; end $$;
select 'ok 8 - radio manage is canonical';

rollback;
