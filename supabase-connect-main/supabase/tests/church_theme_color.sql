\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(_condition boolean, _label text)
returns void language plpgsql as $$
begin
  if not coalesce(_condition, false) then
    raise exception 'FAIL: %', _label;
  end if;
  raise notice 'PASS: %', _label;
end;
$$;

create or replace function pg_temp.assert_theme_color_rejected(_theme_color text)
returns void language plpgsql as $$
begin
  begin
    insert into public.churches (id, name, slug, theme_color)
    values (
      gen_random_uuid(),
      'Invalid Theme Color Church',
      'invalid-theme-color-' || lower(regexp_replace(_theme_color, '[^A-Za-z0-9]', '', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8),
      _theme_color
    );
  exception
    when check_violation then
      raise notice 'PASS: invalid church theme color % rejected', _theme_color;
      return;
  end;

  raise exception 'FAIL: invalid church theme color % was accepted', _theme_color;
end;
$$;

select pg_temp.assert_true(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'theme_color'
  ),
  'churches.theme_color column exists'
);

select pg_temp.assert_true(
  (
    select data_type = 'text'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'theme_color'
  ),
  'churches.theme_color is text'
);

select pg_temp.assert_true(
  (
    select column_default = '''#d4a017''::text'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'theme_color'
  ),
  'churches.theme_color defaults to #d4a017'
);

insert into public.churches (id, name, slug, theme_color)
values ('64000000-0000-4000-8000-000000000001', 'Theme Null Parish', 'theme-null-parish', null);

update public.churches
set theme_color = '#d4a017'
where theme_color is null
  and id = '64000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  (
    select theme_color = '#d4a017'
    from public.churches
    where id = '64000000-0000-4000-8000-000000000001'
  ),
  'existing null theme colors can be backfilled to #d4a017'
);

insert into public.churches (id, name, slug, theme_color) values
  ('64000000-0000-4000-8000-000000000002', 'Theme Upper Parish', 'theme-upper-parish', '#D4A017'),
  ('64000000-0000-4000-8000-000000000003', 'Theme Lower Parish', 'theme-lower-parish', '#123abc');

select pg_temp.assert_true(
  (
    select array_agg(theme_color order by theme_color) = array['#123abc', '#D4A017']
    from public.churches
    where id in (
      '64000000-0000-4000-8000-000000000002',
      '64000000-0000-4000-8000-000000000003'
    )
  ),
  'valid six-digit hex theme colors are accepted'
);

select pg_temp.assert_theme_color_rejected('red');
select pg_temp.assert_theme_color_rejected('#fff');
select pg_temp.assert_theme_color_rejected('123456');
select pg_temp.assert_theme_color_rejected('#12345G');

rollback;
