create table if not exists public.saint_provenance (
  id uuid primary key default gen_random_uuid(),
  saint_id uuid not null references public.saints(id) on delete cascade,
  translation_language_code text null,
  source_organization text not null,
  source_publication text null,
  source_url text null,
  source_checked_date date not null,
  source_role text not null,
  editorial_author text not null,
  editorial_reviewer text not null,
  editorial_approval_date date not null,
  content_license_basis text not null,
  factual_notes text null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saint_provenance_source_role_check check (
    source_role in (
      'factual_reference',
      'quote_source',
      'image_source',
      'translation_reference',
      'license_record'
    )
  )
);

create index if not exists saint_provenance_saint_id_idx
on public.saint_provenance (saint_id);

create index if not exists saint_provenance_saint_language_idx
on public.saint_provenance (saint_id, translation_language_code);

create index if not exists saint_provenance_source_role_idx
on public.saint_provenance (source_role);

create index if not exists saint_provenance_source_checked_date_idx
on public.saint_provenance (source_checked_date desc);

create unique index if not exists saint_provenance_identity_idx
on public.saint_provenance (
  saint_id,
  coalesce(translation_language_code, ''),
  source_role,
  source_organization,
  coalesce(source_publication, ''),
  coalesce(source_url, '')
);

drop trigger if exists update_saint_provenance_updated_at on public.saint_provenance;
create trigger update_saint_provenance_updated_at
before update on public.saint_provenance
for each row
execute function public.update_updated_at_column();

alter table public.saint_provenance enable row level security;

drop policy if exists "Super admins can read saint provenance" on public.saint_provenance;
create policy "Super admins can read saint provenance"
on public.saint_provenance
for select
to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Super admins can insert saint provenance" on public.saint_provenance;
create policy "Super admins can insert saint provenance"
on public.saint_provenance
for insert
to authenticated
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Super admins can update saint provenance" on public.saint_provenance;
create policy "Super admins can update saint provenance"
on public.saint_provenance
for update
to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Super admins can delete saint provenance" on public.saint_provenance;
create policy "Super admins can delete saint provenance"
on public.saint_provenance
for delete
to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

revoke all on table public.saint_provenance from public, anon, authenticated;
grant select, insert, update, delete on public.saint_provenance to authenticated;

create or replace function public.import_canonical_saints(_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saints jsonb;
  v_saint jsonb;
  v_translation jsonb;
  v_provenance jsonb;
  v_slug text;
  v_saint_name text;
  v_language_code text;
  v_translation_language_code text;
  v_source_role text;
  v_feast_month integer;
  v_feast_day integer;
  v_saint_id uuid;
  v_seen_slugs text[] := array[]::text[];
  v_seen_languages text[];
  v_tags text[];
  v_saints_processed integer := 0;
  v_translations_processed integer := 0;
  v_provenance_processed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid())) then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;

  if jsonb_typeof(_payload) is distinct from 'object' then
    raise exception 'Canonical saints payload must be a JSON object' using errcode = '22023';
  end if;

  v_saints := _payload -> 'saints';
  if jsonb_typeof(v_saints) is distinct from 'array' or jsonb_array_length(v_saints) = 0 then
    raise exception 'Canonical saints payload requires a non-empty saints array' using errcode = '22023';
  end if;

  for v_saint in select value from jsonb_array_elements(v_saints)
  loop
    if jsonb_typeof(v_saint) is distinct from 'object' then
      raise exception 'Each saint entry must be a JSON object' using errcode = '22023';
    end if;

    v_slug := nullif(btrim(v_saint ->> 'slug'), '');
    v_saint_name := nullif(btrim(v_saint ->> 'name'), '');

    if v_slug is null or v_slug !~ '^[a-z0-9][a-z0-9-]*$' then
      raise exception 'Each saint requires a valid lowercase slug' using errcode = '22023';
    end if;

    if array_position(v_seen_slugs, v_slug) is not null then
      raise exception 'Duplicate saint slug in payload: %', v_slug using errcode = '22023';
    end if;
    v_seen_slugs := array_append(v_seen_slugs, v_slug);

    if v_saint_name is null then
      raise exception 'Saint % requires name', v_slug using errcode = '22023';
    end if;

    if nullif(btrim(v_saint ->> 'biography_short'), '') is null
      or nullif(btrim(v_saint ->> 'biography_long'), '') is null
      or nullif(btrim(v_saint ->> 'reflection'), '') is null
      or nullif(btrim(v_saint ->> 'prayer'), '') is null
    then
      raise exception 'Saint % requires biography_short, biography_long, reflection, and prayer', v_slug using errcode = '22023';
    end if;

    v_feast_month := nullif(v_saint ->> 'feast_month', '')::integer;
    v_feast_day := nullif(v_saint ->> 'feast_day', '')::integer;

    if v_feast_month is null
      or v_feast_month < 1
      or v_feast_month > 12
      or v_feast_day is null
      or v_feast_day < 1
    then
      raise exception 'Saint % has an invalid feast date', v_slug using errcode = '22023';
    end if;

    if v_feast_day > extract(day from (
      make_date(2024, v_feast_month, 1) + interval '1 month' - interval '1 day'
    ))::integer then
      raise exception 'Saint % has an invalid feast date', v_slug using errcode = '22023';
    end if;

    if nullif(btrim(v_saint ->> 'liturgical_rank'), '') is not null
      and nullif(btrim(v_saint ->> 'liturgical_rank'), '') not in ('Solemnity', 'Feast', 'Memorial', 'Optional Memorial')
    then
      raise exception 'Saint % has an invalid liturgical_rank', v_slug using errcode = '22023';
    end if;

    if v_saint ? 'tags' and jsonb_typeof(v_saint -> 'tags') is distinct from 'array' then
      raise exception 'Saint % tags must be an array', v_slug using errcode = '22023';
    end if;

    select coalesce(array_agg(tag), array[]::text[])
    into v_tags
    from jsonb_array_elements_text(coalesce(v_saint -> 'tags', '[]'::jsonb)) as tag;

    if exists (select 1 from unnest(v_tags) tag where tag !~ '^[a-z0-9][a-z0-9-]*$') then
      raise exception 'Saint % tags must be lowercase kebab-case strings', v_slug using errcode = '22023';
    end if;

    v_seen_languages := array[]::text[];
    if v_saint ? 'translations' then
      if jsonb_typeof(v_saint -> 'translations') is distinct from 'array' then
        raise exception 'Saint % translations must be an array', v_slug using errcode = '22023';
      end if;

      for v_translation in select value from jsonb_array_elements(v_saint -> 'translations')
      loop
        if jsonb_typeof(v_translation) is distinct from 'object' then
          raise exception 'Saint % translation entries must be objects', v_slug using errcode = '22023';
        end if;

        v_language_code := nullif(btrim(v_translation ->> 'language_code'), '');
        if v_language_code is null then
          raise exception 'Saint % translation requires language_code', v_slug using errcode = '22023';
        end if;

        if array_position(v_seen_languages, v_language_code) is not null then
          raise exception 'Duplicate translation language for saint %: %', v_slug, v_language_code using errcode = '22023';
        end if;
        v_seen_languages := array_append(v_seen_languages, v_language_code);

        if nullif(btrim(v_translation ->> 'translated_name'), '') is null
          or nullif(btrim(v_translation ->> 'biography_short'), '') is null
          or nullif(btrim(v_translation ->> 'biography_long'), '') is null
          or nullif(btrim(v_translation ->> 'reflection'), '') is null
          or nullif(btrim(v_translation ->> 'prayer'), '') is null
        then
          raise exception 'Saint % translation % is missing required content', v_slug, v_language_code using errcode = '22023';
        end if;
      end loop;
    end if;

    if jsonb_typeof(v_saint -> 'provenance') is distinct from 'array' or jsonb_array_length(v_saint -> 'provenance') = 0 then
      raise exception 'Saint % requires at least one provenance entry', v_slug using errcode = '22023';
    end if;

    for v_provenance in select value from jsonb_array_elements(v_saint -> 'provenance')
    loop
      if jsonb_typeof(v_provenance) is distinct from 'object' then
        raise exception 'Saint % provenance entries must be objects', v_slug using errcode = '22023';
      end if;

      v_source_role := nullif(btrim(v_provenance ->> 'source_role'), '');
      v_translation_language_code := nullif(btrim(v_provenance ->> 'translation_language_code'), '');

      if v_source_role is null
        or v_source_role not in ('factual_reference', 'quote_source', 'image_source', 'translation_reference', 'license_record')
      then
        raise exception 'Saint % has an invalid provenance source_role', v_slug using errcode = '22023';
      end if;

      if v_translation_language_code is not null and array_position(v_seen_languages, v_translation_language_code) is null then
        raise exception 'Saint % provenance references missing translation language %', v_slug, v_translation_language_code using errcode = '22023';
      end if;

      if nullif(btrim(v_provenance ->> 'source_organization'), '') is null
        or nullif(btrim(v_provenance ->> 'source_checked_date'), '') is null
        or nullif(btrim(v_provenance ->> 'editorial_author'), '') is null
        or nullif(btrim(v_provenance ->> 'editorial_reviewer'), '') is null
        or nullif(btrim(v_provenance ->> 'editorial_approval_date'), '') is null
        or nullif(btrim(v_provenance ->> 'content_license_basis'), '') is null
      then
        raise exception 'Saint % provenance is missing required values', v_slug using errcode = '22023';
      end if;

      perform (v_provenance ->> 'source_checked_date')::date;
      perform (v_provenance ->> 'editorial_approval_date')::date;
    end loop;
  end loop;

  for v_saint in select value from jsonb_array_elements(v_saints)
  loop
    v_slug := btrim(v_saint ->> 'slug');

    select coalesce(array_agg(tag), array[]::text[])
    into v_tags
    from jsonb_array_elements_text(coalesce(v_saint -> 'tags', '[]'::jsonb)) as tag;

    insert into public.saints (
      slug,
      name,
      title,
      feast_month,
      feast_day,
      patron_of,
      birth_year,
      death_year,
      country,
      biography_short,
      biography_long,
      quote,
      reflection,
      prayer,
      image_url,
      color_theme,
      liturgical_rank,
      is_featured,
      scripture_reference,
      tags,
      is_active,
      updated_at
    )
    values (
      v_slug,
      btrim(v_saint ->> 'name'),
      nullif(btrim(v_saint ->> 'title'), ''),
      (v_saint ->> 'feast_month')::integer,
      (v_saint ->> 'feast_day')::integer,
      nullif(btrim(v_saint ->> 'patron_of'), ''),
      nullif(v_saint ->> 'birth_year', '')::integer,
      nullif(v_saint ->> 'death_year', '')::integer,
      nullif(btrim(v_saint ->> 'country'), ''),
      btrim(v_saint ->> 'biography_short'),
      btrim(v_saint ->> 'biography_long'),
      nullif(btrim(v_saint ->> 'quote'), ''),
      btrim(v_saint ->> 'reflection'),
      btrim(v_saint ->> 'prayer'),
      nullif(btrim(v_saint ->> 'image_url'), ''),
      nullif(btrim(v_saint ->> 'color_theme'), ''),
      nullif(btrim(v_saint ->> 'liturgical_rank'), ''),
      coalesce((v_saint ->> 'is_featured')::boolean, false),
      nullif(btrim(v_saint ->> 'scripture_reference'), ''),
      v_tags,
      coalesce((v_saint ->> 'is_active')::boolean, true),
      now()
    )
    on conflict (slug) do update set
      name = excluded.name,
      title = excluded.title,
      feast_month = excluded.feast_month,
      feast_day = excluded.feast_day,
      patron_of = excluded.patron_of,
      birth_year = excluded.birth_year,
      death_year = excluded.death_year,
      country = excluded.country,
      biography_short = excluded.biography_short,
      biography_long = excluded.biography_long,
      quote = excluded.quote,
      reflection = excluded.reflection,
      prayer = excluded.prayer,
      image_url = excluded.image_url,
      color_theme = excluded.color_theme,
      liturgical_rank = excluded.liturgical_rank,
      is_featured = excluded.is_featured,
      scripture_reference = excluded.scripture_reference,
      tags = excluded.tags,
      is_active = excluded.is_active,
      updated_at = now()
    returning id into v_saint_id;

    v_saints_processed := v_saints_processed + 1;

    for v_translation in select value from jsonb_array_elements(coalesce(v_saint -> 'translations', '[]'::jsonb))
    loop
      insert into public.saint_translations (
        saint_id,
        language_code,
        translated_name,
        biography_short,
        biography_long,
        reflection,
        prayer,
        quote
      )
      values (
        v_saint_id,
        btrim(v_translation ->> 'language_code'),
        btrim(v_translation ->> 'translated_name'),
        btrim(v_translation ->> 'biography_short'),
        btrim(v_translation ->> 'biography_long'),
        btrim(v_translation ->> 'reflection'),
        btrim(v_translation ->> 'prayer'),
        nullif(btrim(v_translation ->> 'quote'), '')
      )
      on conflict (saint_id, language_code) do update set
        translated_name = excluded.translated_name,
        biography_short = excluded.biography_short,
        biography_long = excluded.biography_long,
        reflection = excluded.reflection,
        prayer = excluded.prayer,
        quote = excluded.quote;

      v_translations_processed := v_translations_processed + 1;
    end loop;

    for v_provenance in select value from jsonb_array_elements(v_saint -> 'provenance')
    loop
      insert into public.saint_provenance (
        saint_id,
        translation_language_code,
        source_organization,
        source_publication,
        source_url,
        source_checked_date,
        source_role,
        editorial_author,
        editorial_reviewer,
        editorial_approval_date,
        content_license_basis,
        factual_notes,
        created_by,
        updated_by
      )
      values (
        v_saint_id,
        nullif(btrim(v_provenance ->> 'translation_language_code'), ''),
        btrim(v_provenance ->> 'source_organization'),
        nullif(btrim(v_provenance ->> 'source_publication'), ''),
        nullif(btrim(v_provenance ->> 'source_url'), ''),
        (v_provenance ->> 'source_checked_date')::date,
        btrim(v_provenance ->> 'source_role'),
        btrim(v_provenance ->> 'editorial_author'),
        btrim(v_provenance ->> 'editorial_reviewer'),
        (v_provenance ->> 'editorial_approval_date')::date,
        btrim(v_provenance ->> 'content_license_basis'),
        nullif(btrim(v_provenance ->> 'factual_notes'), ''),
        auth.uid(),
        auth.uid()
      )
      on conflict (
        saint_id,
        (coalesce(translation_language_code, '')),
        source_role,
        source_organization,
        (coalesce(source_publication, '')),
        (coalesce(source_url, ''))
      )
      do update set
        source_checked_date = excluded.source_checked_date,
        editorial_author = excluded.editorial_author,
        editorial_reviewer = excluded.editorial_reviewer,
        editorial_approval_date = excluded.editorial_approval_date,
        content_license_basis = excluded.content_license_basis,
        factual_notes = excluded.factual_notes,
        updated_by = auth.uid(),
        updated_at = now();

      v_provenance_processed := v_provenance_processed + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'saints_processed', v_saints_processed,
    'translations_processed', v_translations_processed,
    'provenance_processed', v_provenance_processed
  );
end;
$$;

revoke all on function public.import_canonical_saints(jsonb) from public, anon, authenticated;
grant execute on function public.import_canonical_saints(jsonb) to authenticated;

comment on table public.saint_provenance is
  'Per-saint and per-translation provenance records for production-reviewed canonical saint content.';

comment on function public.import_canonical_saints(jsonb) is
  'Super Admin-only atomic import boundary for canonical saints, translations, and provenance JSON payloads.';
