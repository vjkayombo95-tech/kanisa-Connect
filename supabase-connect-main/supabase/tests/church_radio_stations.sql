\set ON_ERROR_STOP on
begin;

select '1..8';
do $$ begin assert to_regclass('public.radio_stations') is not null; end $$;
select 'ok 1 - platform Radio directory exists';
do $$ begin assert to_regclass('public.church_radio_stations') is not null; end $$;
select 'ok 2 - church Radio selections exist';
do $$ begin assert (select relrowsecurity from pg_class where oid='public.radio_stations'::regclass); end $$;
select 'ok 3 - directory RLS is enabled';
do $$ begin assert exists(select 1 from pg_policies where tablename='radio_stations' and policyname='Super admins manage platform radio directory'); end $$;
select 'ok 4 - technical catalogue is Super Admin managed';
do $$ begin assert exists(select 1 from pg_policies where tablename='church_radio_stations' and cmd='INSERT' and with_check ilike '%radio%manage%approved%'); end $$;
select 'ok 5 - church selection requires manage and approval';
do $$ begin assert exists(select 1 from pg_policies where tablename='radio_stations' and cmd='SELECT' and qual ilike '%is_active%is_approved%'); end $$;
select 'ok 6 - member catalogue reads require active and approved';
do $$ begin assert public.is_safe_public_https_url('https://example.com/live') and not public.is_safe_public_https_url('https://127.0.0.1/live'); end $$;
select 'ok 7 - public HTTPS validator rejects loopback';
do $$ begin assert (public.church_permission_constraint_rule('church_admin','radio','manage')->>'classification')='CONFIGURABLE'; end $$;
select 'ok 8 - church Radio selection manage remains canonical';

rollback;
