-- Rollback-only validation for Prayer Library provenance and translation families.
\set ON_ERROR_STOP on
begin;

create schema if not exists prayer_translation_test;
create or replace function prayer_translation_test.assert_true(value boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(value, false) then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

select prayer_translation_test.assert_true(
  (select count(*) = 55 and count(translation_group_id) = 55 and count(translation_key) = 55
   from public.content_prayers where metadata ->> 'seeded_title_only' = 'true'),
  'all 55 seeded records have translation identity'
);
select prayer_translation_test.assert_true(
  (select count(*) = 55 from public.content_prayers
   where metadata ->> 'seeded_title_only' = 'true' and body is null and status = 'draft'),
  'seeded bodies and statuses were unchanged'
);
select prayer_translation_test.assert_true(
  (select bool_and(prayer_code = translation_key) from public.content_prayers
   where metadata ->> 'seeded_title_only' = 'true'),
  'seeded prayer codes stayed stable and became conceptual translation keys'
);
select prayer_translation_test.assert_true(
  (select max(version_count) = 1 from (
    select p.id, count(v.id) as version_count
    from public.content_prayers p left join public.content_versions v
      on v.content_type = 'prayer' and v.content_id = p.id
    where p.metadata ->> 'seeded_title_only' = 'true' group by p.id
  ) versions),
  'backfill created no harmless audit versions'
);

insert into public.churches (id, name, slug, church_code) values
  ('da000000-0000-4000-8000-000000000001', 'Translation Test Church A', 'translation-test-church-a', 'KC-TRA-TST-001'),
  ('db000000-0000-4000-8000-000000000002', 'Translation Test Church B', 'translation-test-church-b', 'KC-TRB-TST-002');

do $$
declare
  v_sw uuid := (select id from public.content_languages where code = 'sw');
  v_en uuid := (select id from public.content_languages where code = 'en');
  v_la uuid := (select id from public.content_languages where code = 'la');
  v_group uuid := gen_random_uuid();
  v_parish_group uuid := gen_random_uuid();
begin
  insert into public.content_prayers (id, prayer_code, title, slug, body, language_id, prayer_type, is_global, church_id, translation_group_id, translation_key)
  values ('d1000000-0000-4000-8000-000000000001', 'TRANSLATION_TEST_SW', 'Translation Test SW', 'translation-test-sw', null, v_sw, 'single', true, null, v_group, 'TRANSLATION_TEST');
  insert into public.content_prayers (id, prayer_code, title, slug, body, language_id, prayer_type, is_global, church_id, translation_group_id, translation_key)
  values ('d1000000-0000-4000-8000-000000000002', 'TRANSLATION_TEST_EN', 'Translation Test EN', 'translation-test-en', null, v_en, 'single', true, null, v_group, 'TRANSLATION_TEST');

  begin
    insert into public.content_prayers (prayer_code, title, slug, body, language_id, prayer_type, is_global, translation_group_id, translation_key)
    values ('TRANSLATION_TEST_SW_2', 'Duplicate SW', 'translation-test-sw-2', null, v_sw, 'single', true, v_group, 'TRANSLATION_TEST');
    raise exception 'duplicate language was accepted';
  exception when unique_violation then null; end;

  begin
    insert into public.content_prayers (prayer_code, title, slug, body, language_id, prayer_type, is_global, translation_group_id, translation_key)
    values ('TRANSLATION_TEST_LA_BAD_TYPE', 'Bad Type', 'translation-test-la-type', null, v_la, 'litany', true, v_group, 'TRANSLATION_TEST');
    raise exception 'incompatible type was accepted';
  exception when check_violation then null; end;

  begin
    insert into public.content_prayers (prayer_code, title, slug, body, language_id, prayer_type, is_global, church_id, translation_group_id, translation_key)
    values ('TRANSLATION_TEST_LA_PARISH', 'Bad Ownership', 'translation-test-la-parish', null, v_la, 'single', false, 'da000000-0000-4000-8000-000000000001', v_group, 'TRANSLATION_TEST');
    raise exception 'global/parish mix was accepted';
  exception when check_violation then null; end;

  insert into public.content_prayers (prayer_code, title, slug, body, language_id, prayer_type, is_global, church_id, translation_group_id, translation_key)
  values ('PARISH_TRANSLATION_SW', 'Parish SW', 'parish-translation-sw', null, v_sw, 'single', false, 'da000000-0000-4000-8000-000000000001', v_parish_group, 'PARISH_TRANSLATION');
  begin
    insert into public.content_prayers (prayer_code, title, slug, body, language_id, prayer_type, is_global, church_id, translation_group_id, translation_key)
    values ('PARISH_TRANSLATION_EN', 'Parish EN', 'parish-translation-en', null, v_en, 'single', false, 'db000000-0000-4000-8000-000000000002', v_parish_group, 'PARISH_TRANSLATION');
    raise exception 'cross-church family was accepted';
  exception when check_violation then null; end;
end $$;

select prayer_translation_test.assert_true(
  (select count(*) = 2 from public.content_prayers where translation_key = 'TRANSLATION_TEST'),
  'one row per distinct language is permitted'
);

rollback;
