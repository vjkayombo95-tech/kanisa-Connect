-- Daily Readings transactional import execution foundation.
-- Accepts already-normalized, already-hashed source rows and re-derives the
-- safe import decision inside a Super Admin-only database transaction.

create or replace function public.apply_daily_readings_import(
  _import_batch_id uuid,
  _sources jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_source jsonb;
  v_payload jsonb;
  v_source_key text;
  v_source_record_id text;
  v_source_version text;
  v_source_url text;
  v_source_hash text;
  v_normalization_version text;
  v_reading_date date;
  v_language_code text;
  v_language_id uuid;
  v_existing_source record;
  v_collision record;
  v_existing_item record;
  v_current_payload jsonb;
  v_last_payload jsonb;
  v_item_id uuid;
  v_target_id uuid;
  v_decision text;
  v_status text;
  v_error_code text;
  v_error_message text;
  v_results jsonb := '[]'::jsonb;
  v_seen_identities text[] := array[]::text[];
  v_identity text;
  v_imported integer;
  v_skipped integer;
  v_conflicts integer;
  v_failed integer;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (public.is_platform_super_admin(v_actor) or public.is_super_admin(v_actor)) then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;

  if _import_batch_id is null then
    raise exception 'Daily Readings import batch is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.content_import_batches cib
    where cib.id = _import_batch_id
      and cib.content_type = 'daily_reading'
    for update
  ) then
    raise exception 'Daily Readings import batch does not exist' using errcode = '22023';
  end if;

  if jsonb_typeof(_sources) is distinct from 'array' or jsonb_array_length(_sources) = 0 then
    raise exception 'A non-empty Daily Readings source array is required' using errcode = '22023';
  end if;

  for v_source in select value from jsonb_array_elements(_sources)
  loop
    if jsonb_typeof(v_source) is distinct from 'object' then
      raise exception 'Every Daily Readings source item must be a JSON object' using errcode = '22023';
    end if;

    v_payload := v_source -> 'normalized_payload';
    if jsonb_typeof(v_payload) is distinct from 'object' then
      raise exception 'Every Daily Readings source item requires normalized_payload' using errcode = '22023';
    end if;

    v_source_key := nullif(btrim(v_payload ->> 'source_key'), '');
    v_source_record_id := nullif(btrim(v_payload ->> 'source_record_id'), '');
    v_source_version := nullif(btrim(v_payload ->> 'source_version'), '');
    v_source_url := nullif(btrim(v_source ->> 'source_url'), '');
    v_source_hash := nullif(btrim(v_source ->> 'source_hash'), '');
    v_normalization_version := nullif(btrim(v_source ->> 'normalization_version'), '');
    v_language_code := lower(nullif(btrim(v_payload ->> 'language_code'), ''));

    if v_source_key is null
      or v_source_record_id is null
      or v_source_hash is null
      or v_normalization_version is null
      or v_language_code is null
      or nullif(btrim(v_payload ->> 'reading_date'), '') is null
      or nullif(btrim(v_payload ->> 'first_reading_reference'), '') is null
      or nullif(btrim(v_payload ->> 'responsorial_psalm_reference'), '') is null
      or nullif(btrim(v_payload ->> 'gospel_reference'), '') is null
      or nullif(btrim(v_payload ->> 'source_attribution'), '') is null
    then
      raise exception 'Daily Readings source item is missing required normalized fields' using errcode = '22023';
    end if;

    if v_source_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'Daily Readings source_hash must be a lowercase SHA-256 hex digest' using errcode = '22023';
    end if;

    v_reading_date := (v_payload ->> 'reading_date')::date;
    v_identity := v_source_key || ':' || v_source_record_id;
    if array_position(v_seen_identities, v_identity) is not null then
      raise exception 'Duplicate Daily Readings source identity in request: %', v_identity using errcode = '22023';
    end if;
    v_seen_identities := array_append(v_seen_identities, v_identity);

    select cl.id
      into v_language_id
    from public.content_languages cl
    where cl.code = v_language_code;

    if v_language_id is null then
      raise exception 'Daily Readings language_code is not configured: %', v_language_code using errcode = '22023';
    end if;

    select cii.id, cii.status, cii.error_code, cii.target_record_id, cii.source_hash, cii.source_payload
      into v_existing_item
    from public.content_import_items cii
    where cii.import_batch_id = _import_batch_id
      and cii.content_type = 'daily_reading'
      and cii.source_key = v_source_key
      and cii.source_record_id = v_source_record_id
    for update;

    if v_existing_item.id is not null then
      if v_existing_item.source_hash <> v_source_hash or v_existing_item.source_payload <> v_payload then
        raise exception 'Daily Readings import item already exists with different source content: %', v_identity using errcode = '22023';
      end if;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'source_key', v_source_key,
        'source_record_id', v_source_record_id,
        'decision', 'retry_existing_item',
        'ledger_status', v_existing_item.status,
        'error_code', v_existing_item.error_code,
        'target_record_id', v_existing_item.target_record_id,
        'import_item_id', v_existing_item.id
      ));
      continue;
    end if;

    select
      cdr.id,
      cdr.reading_date,
      cdr.language_id,
      cl.code as language_code,
      cdr.source_key,
      cdr.source_record_id,
      cdr.source_version,
      cdr.source_url,
      cdr.last_imported_source_hash,
      last_item.source_payload as last_imported_source_payload,
      cdr.status,
      cdr.visibility,
      cdr.liturgical_year,
      cdr.liturgical_season,
      cdr.celebration,
      cdr.liturgical_color,
      cdr.first_reading_reference,
      cdr.responsorial_psalm_reference,
      cdr.second_reading_reference,
      cdr.gospel_acclamation_reference,
      cdr.gospel_reference,
      cdr.source_attribution
      into v_existing_source
    from public.content_daily_readings cdr
    left join public.content_languages cl on cl.id = cdr.language_id
    left join public.content_import_items last_item on last_item.id = cdr.last_import_item_id
    where cdr.source_key = v_source_key
      and cdr.source_record_id = v_source_record_id
    for update of cdr;

    select
      cdr.id,
      cdr.source_key,
      cdr.source_record_id
      into v_collision
    from public.content_daily_readings cdr
    where cdr.reading_date = v_reading_date
      and cdr.language_id = v_language_id
      and (
        cdr.source_key is distinct from v_source_key
        or cdr.source_record_id is distinct from v_source_record_id
      )
    for update;

    v_target_id := null;
    v_error_code := null;
    v_error_message := null;

    if v_existing_source.id is not null then
      v_target_id := v_existing_source.id;

      if v_existing_source.last_imported_source_payload is not null then
        v_current_payload := jsonb_build_object(
          'source_key', v_existing_source.source_key,
          'source_record_id', v_existing_source.source_record_id,
          'source_version', v_existing_source.source_version,
          'reading_date', to_char(v_existing_source.reading_date, 'YYYY-MM-DD'),
          'language_code', v_existing_source.language_code,
          'liturgical_year', coalesce(v_existing_source.liturgical_year, ''),
          'liturgical_season', coalesce(v_existing_source.liturgical_season, ''),
          'celebration', coalesce(v_existing_source.celebration, ''),
          'liturgical_color', coalesce(v_existing_source.liturgical_color, ''),
          'first_reading_reference', coalesce(v_existing_source.first_reading_reference, ''),
          'responsorial_psalm_reference', coalesce(v_existing_source.responsorial_psalm_reference, ''),
          'second_reading_reference', v_existing_source.second_reading_reference,
          'gospel_acclamation_reference', v_existing_source.gospel_acclamation_reference,
          'gospel_reference', coalesce(v_existing_source.gospel_reference, ''),
          'source_attribution', coalesce(v_existing_source.source_attribution, '')
        );
        v_last_payload := jsonb_build_object(
          'source_key', v_existing_source.last_imported_source_payload ->> 'source_key',
          'source_record_id', v_existing_source.last_imported_source_payload ->> 'source_record_id',
          'source_version', v_existing_source.last_imported_source_payload -> 'source_version',
          'reading_date', v_existing_source.last_imported_source_payload ->> 'reading_date',
          'language_code', v_existing_source.last_imported_source_payload ->> 'language_code',
          'liturgical_year', coalesce(v_existing_source.last_imported_source_payload ->> 'liturgical_year', ''),
          'liturgical_season', coalesce(v_existing_source.last_imported_source_payload ->> 'liturgical_season', ''),
          'celebration', coalesce(v_existing_source.last_imported_source_payload ->> 'celebration', ''),
          'liturgical_color', coalesce(v_existing_source.last_imported_source_payload ->> 'liturgical_color', ''),
          'first_reading_reference', coalesce(v_existing_source.last_imported_source_payload ->> 'first_reading_reference', ''),
          'responsorial_psalm_reference', coalesce(v_existing_source.last_imported_source_payload ->> 'responsorial_psalm_reference', ''),
          'second_reading_reference', v_existing_source.last_imported_source_payload -> 'second_reading_reference',
          'gospel_acclamation_reference', v_existing_source.last_imported_source_payload -> 'gospel_acclamation_reference',
          'gospel_reference', coalesce(v_existing_source.last_imported_source_payload ->> 'gospel_reference', ''),
          'source_attribution', coalesce(v_existing_source.last_imported_source_payload ->> 'source_attribution', '')
        );
      end if;

      if v_existing_source.last_imported_source_payload is not null and v_current_payload <> v_last_payload then
        v_decision := 'conflict_manual_drift';
        v_status := 'conflict';
        v_error_code := 'manual_drift';
        v_error_message := 'CMS Daily Reading source-controlled fields changed since the last accepted import.';
      elsif v_existing_source.last_imported_source_hash = v_source_hash then
        v_decision := 'skip_unchanged';
        v_status := 'skipped';
      elsif v_existing_source.status in ('published', 'featured') then
        v_decision := 'conflict_published_source_changed';
        v_status := 'conflict';
        v_error_code := 'published_source_changed';
        v_error_message := 'Published or featured CMS Daily Reading has an upstream source change.';
      elsif v_collision.id is not null then
        v_decision := 'conflict_date_language_source_collision';
        v_status := 'conflict';
        v_error_code := 'date_language_collision';
        v_error_message := 'A different source identity already exists for the same reading date and language.';
        v_target_id := v_collision.id;
      else
        v_decision := 'update_draft_from_source';
        v_status := 'imported';
      end if;
    elsif v_collision.id is not null then
      v_target_id := v_collision.id;
      v_status := 'conflict';
      if v_collision.source_key is not null and v_collision.source_record_id is not null then
        v_decision := 'conflict_date_language_source_collision';
        v_error_code := 'date_language_collision';
        v_error_message := 'A different source identity already exists for the same reading date and language.';
      else
        v_decision := 'conflict_manual_content_collision';
        v_error_code := 'manual_content_collision';
        v_error_message := 'Manual CMS Daily Reading already exists for the same reading date and language.';
      end if;
    else
      v_decision := 'create_draft';
      v_status := 'imported';
    end if;

    v_item_id := gen_random_uuid();

    insert into public.content_import_items (
      id,
      import_batch_id,
      content_type,
      source_key,
      source_record_id,
      source_version,
      source_url,
      source_hash,
      target_table,
      target_record_id,
      reading_date,
      language_id,
      status,
      error_message,
      source_payload,
      error_code,
      normalization_version
    )
    values (
      v_item_id,
      _import_batch_id,
      'daily_reading',
      v_source_key,
      v_source_record_id,
      v_source_version,
      v_source_url,
      v_source_hash,
      'content_daily_readings',
      v_target_id,
      v_reading_date,
      v_language_id,
      v_status,
      v_error_message,
      v_payload,
      v_error_code,
      v_normalization_version
    );

    if v_decision = 'create_draft' then
      insert into public.content_daily_readings (
        reading_date,
        liturgical_year,
        liturgical_season,
        celebration,
        liturgical_color,
        first_reading_reference,
        responsorial_psalm_reference,
        second_reading_reference,
        gospel_acclamation_reference,
        gospel_reference,
        language_id,
        status,
        visibility,
        source_attribution,
        source_key,
        source_record_id,
        source_version,
        source_url,
        last_imported_source_hash,
        last_imported_at,
        last_import_item_id,
        import_batch_id,
        created_by,
        updated_by
      )
      values (
        v_reading_date,
        coalesce(v_payload ->> 'liturgical_year', ''),
        coalesce(v_payload ->> 'liturgical_season', ''),
        coalesce(v_payload ->> 'celebration', ''),
        coalesce(v_payload ->> 'liturgical_color', ''),
        btrim(v_payload ->> 'first_reading_reference'),
        btrim(v_payload ->> 'responsorial_psalm_reference'),
        nullif(btrim(v_payload ->> 'second_reading_reference'), ''),
        nullif(btrim(v_payload ->> 'gospel_acclamation_reference'), ''),
        btrim(v_payload ->> 'gospel_reference'),
        v_language_id,
        'draft',
        'member',
        btrim(v_payload ->> 'source_attribution'),
        v_source_key,
        v_source_record_id,
        v_source_version,
        v_source_url,
        v_source_hash,
        now(),
        v_item_id,
        _import_batch_id,
        v_actor,
        v_actor
      )
      returning id into v_target_id;

      update public.content_import_items
      set target_record_id = v_target_id
      where id = v_item_id;
    elsif v_decision = 'update_draft_from_source' then
      update public.content_daily_readings
      set
        reading_date = v_reading_date,
        liturgical_year = coalesce(v_payload ->> 'liturgical_year', ''),
        liturgical_season = coalesce(v_payload ->> 'liturgical_season', ''),
        celebration = coalesce(v_payload ->> 'celebration', ''),
        liturgical_color = coalesce(v_payload ->> 'liturgical_color', ''),
        first_reading_reference = btrim(v_payload ->> 'first_reading_reference'),
        responsorial_psalm_reference = btrim(v_payload ->> 'responsorial_psalm_reference'),
        second_reading_reference = nullif(btrim(v_payload ->> 'second_reading_reference'), ''),
        gospel_acclamation_reference = nullif(btrim(v_payload ->> 'gospel_acclamation_reference'), ''),
        gospel_reference = btrim(v_payload ->> 'gospel_reference'),
        language_id = v_language_id,
        source_attribution = btrim(v_payload ->> 'source_attribution'),
        source_key = v_source_key,
        source_record_id = v_source_record_id,
        source_version = v_source_version,
        source_url = v_source_url,
        last_imported_source_hash = v_source_hash,
        last_imported_at = now(),
        last_import_item_id = v_item_id,
        import_batch_id = _import_batch_id,
        updated_by = v_actor
      where id = v_existing_source.id;
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'source_key', v_source_key,
      'source_record_id', v_source_record_id,
      'decision', v_decision,
      'ledger_status', v_status,
      'error_code', v_error_code,
      'target_record_id', v_target_id,
      'import_item_id', v_item_id
    ));
  end loop;

  select
    count(*) filter (where status = 'imported'),
    count(*) filter (where status = 'skipped'),
    count(*) filter (where status = 'conflict'),
    count(*) filter (where status = 'failed')
    into v_imported, v_skipped, v_conflicts, v_failed
  from public.content_import_items
  where import_batch_id = _import_batch_id
    and content_type = 'daily_reading';

  update public.content_import_batches
  set
    imported_at = now(),
    total_rows = v_imported + v_skipped + v_conflicts + v_failed,
    valid_rows = v_imported + v_skipped,
    invalid_rows = v_conflicts + v_failed,
    imported_rows = v_imported,
    skipped_rows = v_skipped,
    updated_rows = v_imported,
    status = case
      when v_conflicts + v_failed > 0 and v_imported + v_skipped > 0 then 'Partially Imported'
      when v_conflicts + v_failed > 0 then 'Validation Failed'
      else 'Imported'
    end,
    validation_summary = jsonb_build_object(
      'content_type', 'daily_reading',
      'imported', v_imported,
      'skipped', v_skipped,
      'conflicts', v_conflicts,
      'failed', v_failed,
      'forced_status_for_new_content', 'draft',
      'forced_visibility_for_new_content', 'member'
    )
  where id = _import_batch_id;

  return jsonb_build_object(
    'batch_id', _import_batch_id,
    'imported', v_imported,
    'skipped', v_skipped,
    'conflicts', v_conflicts,
    'failed', v_failed,
    'results', v_results
  );
end;
$$;

revoke all on function public.apply_daily_readings_import(uuid, jsonb) from public;
revoke all on function public.apply_daily_readings_import(uuid, jsonb) from anon;
revoke all on function public.apply_daily_readings_import(uuid, jsonb) from authenticated;
grant execute on function public.apply_daily_readings_import(uuid, jsonb) to authenticated;

comment on function public.apply_daily_readings_import(uuid, jsonb) is
  'Super Admin-only transactional execution boundary for normalized Daily Readings imports. Revalidates source decisions, writes CMS rows as draft/member only, preserves editorial fields, and records import-item outcomes atomically.';
