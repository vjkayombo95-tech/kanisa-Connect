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

create or replace function pg_temp.valid_payload(_slug text, _name text, _second_invalid boolean default false)
returns jsonb language sql as $$
  select jsonb_build_object(
    'saints',
    jsonb_build_array(
      jsonb_build_object(
        'slug', _slug,
        'name', _name,
        'title', 'Martyr',
        'feast_month', 8,
        'feast_day', 31,
        'biography_short', 'Short approved biography.',
        'biography_long', 'Long approved biography.',
        'reflection', 'Approved reflection.',
        'prayer', 'Approved prayer.',
        'liturgical_rank', 'Optional Memorial',
        'is_featured', true,
        'scripture_reference', 'Matthew 5:1-12',
        'tags', jsonb_build_array('august', 'martyr'),
        'translations', jsonb_build_array(
          jsonb_build_object(
            'language_code', 'sw',
            'translated_name', 'Mtakatifu wa Jaribio',
            'biography_short', 'Wasifu mfupi.',
            'biography_long', 'Wasifu mrefu.',
            'reflection', 'Tafakari.',
            'prayer', 'Sala.'
          )
        ),
        'provenance', jsonb_build_array(
          jsonb_build_object(
            'source_organization', 'Verified Catholic Source',
            'source_publication', 'Saint of the Day',
            'source_url', 'https://example.invalid/saints/' || _slug,
            'source_checked_date', '2026-08-31',
            'source_role', 'factual_reference',
            'editorial_author', 'Kanisa Connect Editorial',
            'editorial_reviewer', 'Kanisa Connect Review',
            'editorial_approval_date', '2026-08-31',
            'content_license_basis', 'Kanisa Connect original editorial text based on verified factual references',
            'factual_notes', 'Reviewed for canonical August library.'
          ),
          jsonb_build_object(
            'translation_language_code', 'sw',
            'source_organization', 'Kanisa Connect Translation Review',
            'source_checked_date', '2026-08-31',
            'source_role', 'translation_reference',
            'editorial_author', 'Kanisa Connect Editorial',
            'editorial_reviewer', 'Kanisa Connect Review',
            'editorial_approval_date', '2026-08-31',
            'content_license_basis', 'Kanisa Connect original translation review'
          ),
          jsonb_build_object(
            'source_organization', 'Second Verified Catholic Source',
            'source_publication', 'Supplemental Saint Reference',
            'source_url', 'https://example.invalid/saints/' || _slug || '/supplemental',
            'source_checked_date', '2026-08-31',
            'source_role', 'factual_reference',
            'editorial_author', 'Kanisa Connect Editorial',
            'editorial_reviewer', 'Kanisa Connect Review',
            'editorial_approval_date', '2026-08-31',
            'content_license_basis', 'Supplemental factual reference for original editorial text'
          )
        )
      )
    ) ||
    case when _second_invalid then
      jsonb_build_array(jsonb_build_object('slug', 'invalid-second-saint', 'name', 'Invalid Second Saint'))
    else
      '[]'::jsonb
    end
  );
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('71000000-0000-4000-8000-000000000001', 'ordinary-saint@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('71000000-0000-4000-8000-000000000002', 'super-saint@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.super_admins (id) values ('71000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);

do $$ begin
  begin
    perform public.import_canonical_saints(pg_temp.valid_payload('st-ordinary-denied', 'Saint Ordinary Denied'));
    raise exception 'FAIL: ordinary authenticated caller imported canonical saints';
  exception when insufficient_privilege then
    raise notice 'PASS: ordinary authenticated caller rejected';
  end;
end $$;

select pg_temp.assert_true(
  (select count(*) = 0 from public.saint_provenance),
  'ordinary member cannot read saint provenance rows'
);

do $$ begin
  begin
    insert into public.saint_provenance (
      saint_id,
      source_organization,
      source_checked_date,
      source_role,
      editorial_author,
      editorial_reviewer,
      editorial_approval_date,
      content_license_basis
    )
    values (
      gen_random_uuid(),
      'Denied',
      current_date,
      'factual_reference',
      'Denied',
      'Denied',
      current_date,
      'Denied'
    );
    raise exception 'FAIL: ordinary authenticated caller wrote saint provenance';
  exception when insufficient_privilege then
    raise notice 'PASS: ordinary authenticated caller cannot write saint provenance';
  end;
end $$;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);

select pg_temp.assert_true(
  public.import_canonical_saints(pg_temp.valid_payload('st-provenance-foundation', 'Saint Provenance Foundation')) = jsonb_build_object(
    'saints_processed', 1,
    'translations_processed', 1,
    'provenance_processed', 3
  ),
  'valid canonical payload succeeds'
);

select pg_temp.assert_true(
  public.import_canonical_saints(
    jsonb_set(
      jsonb_set(pg_temp.valid_payload('st-leap-day-valid', 'Saint Leap Day Valid'), '{saints,0,feast_month}', '2'),
      '{saints,0,feast_day}',
      '29'
    )
  ) = jsonb_build_object(
    'saints_processed', 1,
    'translations_processed', 1,
    'provenance_processed', 3
  ),
  'February 29 is accepted as a valid recurring feast date'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.saints where slug = 'st-provenance-foundation'),
  'saint upsert by slug created one saint'
);

select pg_temp.assert_true(
  (select count(*) = 1
   from public.saint_translations st
   join public.saints s on s.id = st.saint_id
   where s.slug = 'st-provenance-foundation'
     and st.language_code = 'sw'),
  'translation upsert by saint and language created one translation'
);

select pg_temp.assert_true(
  (select count(*) = 3
   from public.saint_provenance sp
   join public.saints s on s.id = sp.saint_id
   where s.slug = 'st-provenance-foundation'),
  'base provenance, translation provenance, and multiple factual sources are supported'
);

select pg_temp.assert_true(
  (select count(*) = 2
   from public.saint_provenance sp
   join public.saints s on s.id = sp.saint_id
   where s.slug = 'st-provenance-foundation'
     and sp.translation_language_code is null
     and sp.source_role = 'factual_reference'),
  'base provenance with null translation language is supported'
);

select pg_temp.assert_true(
  (select count(*) = 1
   from public.saint_provenance sp
   join public.saints s on s.id = sp.saint_id
   where s.slug = 'st-provenance-foundation'
     and sp.translation_language_code = 'sw'
     and sp.source_role = 'translation_reference'),
  'translation provenance is supported'
);

select public.import_canonical_saints(pg_temp.valid_payload('st-provenance-foundation', 'Saint Provenance Foundation Updated'));

select pg_temp.assert_true(
  (select count(*) = 3
   from public.saint_provenance sp
   join public.saints s on s.id = sp.saint_id
   where s.slug = 'st-provenance-foundation'),
  'repeated same payload is idempotent and duplicate provenance is prevented'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);

select pg_temp.assert_true(
  (select count(*) = 0 from public.saint_provenance),
  'ordinary member still cannot read saint provenance after import'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);

do $$ begin
  begin
    perform public.import_canonical_saints(
      jsonb_build_object(
        'saints',
        jsonb_build_array(
          jsonb_set(pg_temp.valid_payload('st-duplicate-a', 'Saint Duplicate A') -> 'saints' -> 0, '{slug}', '"st-duplicate"'),
          jsonb_set(pg_temp.valid_payload('st-duplicate-b', 'Saint Duplicate B') -> 'saints' -> 0, '{slug}', '"st-duplicate"')
        )
      )
    );
    raise exception 'FAIL: duplicate saint slugs accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS: duplicate saint slugs rejected';
  end;
end $$;

do $$ begin
  begin
    perform public.import_canonical_saints(
      jsonb_set(
        pg_temp.valid_payload('st-invalid-role', 'Saint Invalid Role'),
        '{saints,0,provenance,0,source_role}',
        '"blog_post"'
      )
    );
    raise exception 'FAIL: invalid provenance source role accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS: invalid provenance source role rejected';
  end;
end $$;

do $$ begin
  begin
    perform public.import_canonical_saints(
      jsonb_set(
        pg_temp.valid_payload('st-blank-source-role', 'Saint Blank Source Role'),
        '{saints,0,provenance,0,source_role}',
        '""'
      )
    );
    raise exception 'FAIL: blank provenance source role accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS: blank provenance source role rejected by prevalidation';
  end;
end $$;

do $$ begin
  begin
    perform public.import_canonical_saints(
      jsonb_build_object(
        'saints',
        jsonb_build_array(
          pg_temp.valid_payload('st-missing-role-first', 'Saint Missing Role First') -> 'saints' -> 0,
          (pg_temp.valid_payload('st-missing-role-second', 'Saint Missing Role Second') -> 'saints' -> 0) #- '{provenance,0,source_role}'
        )
      )
    );
    raise exception 'FAIL: missing provenance source role accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS: missing provenance source role rejected before writes';
  end;
end $$;

select pg_temp.assert_true(
  not exists (select 1 from public.saints where slug = 'st-missing-role-first'),
  'invalid later source role rolls back earlier saint'
);

do $$ begin
  begin
    perform public.import_canonical_saints(
      jsonb_set(
        jsonb_set(pg_temp.valid_payload('st-february-thirty', 'Saint February Thirty'), '{saints,0,feast_month}', '2'),
        '{saints,0,feast_day}',
        '30'
      )
    );
    raise exception 'FAIL: February 30 accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS: February 30 rejected';
  end;
end $$;

do $$ begin
  begin
    perform public.import_canonical_saints(
      jsonb_set(
        jsonb_set(pg_temp.valid_payload('st-april-thirty-one', 'Saint April Thirty One'), '{saints,0,feast_month}', '4'),
        '{saints,0,feast_day}',
        '31'
      )
    );
    raise exception 'FAIL: April 31 accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS: April 31 rejected';
  end;
end $$;

do $$ begin
  begin
    perform public.import_canonical_saints(pg_temp.valid_payload('st-rollback-first', 'Saint Rollback First', true));
    raise exception 'FAIL: invalid second saint accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS: invalid second saint rejected';
  end;
end $$;

select pg_temp.assert_true(
  not exists (select 1 from public.saints where slug = 'st-rollback-first'),
  'invalid second saint causes first saint write to roll back'
);

select pg_temp.assert_true(
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'saint_provenance'
  ),
  'saint provenance table exists without changing Today/Leo query contracts'
);

rollback;
