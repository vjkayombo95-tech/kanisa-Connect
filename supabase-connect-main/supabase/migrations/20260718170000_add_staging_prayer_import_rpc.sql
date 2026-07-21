-- Transactional, staging-locked execution boundary for the controlled Prayer Library importer.
-- Workbook parsing and planning remain client-side; this function accepts only an already
-- validated update plan and always forces every affected prayer back to draft.

create or replace function public.apply_staging_prayer_import(
  _filename text,
  _workbook_checksum text,
  _changes jsonb,
  _confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_change jsonb;
  v_patch jsonb;
  v_id uuid;
  v_code text;
  v_expected_updated_at timestamptz;
  v_updated integer := 0;
  v_batch_id uuid;
  v_issuer text := coalesce(auth.jwt() ->> 'iss', '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid())) then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;
  if v_issuer not like '%nunfrjcuimaytydnaqtt.supabase.co/auth/v1' then
    raise exception 'Prayer imports are restricted to the approved staging project' using errcode = '42501';
  end if;
  if _confirmation <> 'IMPORT_PRAYERS_TO_STAGING_AS_DRAFT' then
    raise exception 'Exact staging import confirmation is required' using errcode = '22023';
  end if;
  if nullif(btrim(_filename), '') is null or nullif(btrim(_workbook_checksum), '') is null then
    raise exception 'Filename and workbook checksum are required' using errcode = '22023';
  end if;
  if jsonb_typeof(_changes) <> 'array' or jsonb_array_length(_changes) = 0 then
    raise exception 'A non-empty validated update plan is required' using errcode = '22023';
  end if;

  for v_change in select value from jsonb_array_elements(_changes)
  loop
    v_id := nullif(v_change ->> 'recordId', '')::uuid;
    v_code := nullif(btrim(v_change ->> 'prayerCode'), '');
    v_expected_updated_at := nullif(v_change ->> 'expectedUpdatedAt', '')::timestamptz;
    v_patch := coalesce(v_change -> 'patch', '{}'::jsonb);

    if v_id is null or v_code is null or v_expected_updated_at is null then
      raise exception 'Every planned change requires recordId, prayerCode, and expectedUpdatedAt' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_object_keys(v_patch) key
      where key not in (
        'title', 'summary', 'body', 'category_id', 'language_id', 'visibility',
        'recommended_time', 'scripture_reference', 'liturgical_season', 'audio_url',
        'author', 'source', 'source_title', 'source_type', 'source_organization',
        'source_reference', 'source_url', 'source_notes', 'copyright_holder',
        'copyright_notice', 'license_type', 'license_reference', 'content_edition',
        'content_version_label', 'ecclesial_approval_status',
        'ecclesial_approval_authority', 'ecclesial_approval_reference', 'reviewed_by',
        'reviewed_at', 'metadata'
      )
    ) then
      raise exception 'Import plan contains a forbidden field' using errcode = '22023';
    end if;

    update public.content_prayers p set
      title = case when v_patch ? 'title' then nullif(btrim(v_patch ->> 'title'), '') else p.title end,
      summary = case when v_patch ? 'summary' then nullif(v_patch ->> 'summary', '') else p.summary end,
      body = case when v_patch ? 'body' then nullif(v_patch ->> 'body', '') else p.body end,
      category_id = case when v_patch ? 'category_id' then (v_patch ->> 'category_id')::uuid else p.category_id end,
      language_id = case when v_patch ? 'language_id' then (v_patch ->> 'language_id')::uuid else p.language_id end,
      visibility = case when v_patch ? 'visibility' then v_patch ->> 'visibility' else p.visibility end,
      recommended_time = case when v_patch ? 'recommended_time' then nullif(v_patch ->> 'recommended_time', '') else p.recommended_time end,
      scripture_reference = case when v_patch ? 'scripture_reference' then nullif(v_patch ->> 'scripture_reference', '') else p.scripture_reference end,
      liturgical_season = case when v_patch ? 'liturgical_season' then nullif(v_patch ->> 'liturgical_season', '') else p.liturgical_season end,
      audio_url = case when v_patch ? 'audio_url' then nullif(v_patch ->> 'audio_url', '') else p.audio_url end,
      author = case when v_patch ? 'author' then nullif(v_patch ->> 'author', '') else p.author end,
      source = case when v_patch ? 'source' then nullif(v_patch ->> 'source', '') else p.source end,
      source_title = case when v_patch ? 'source_title' then nullif(v_patch ->> 'source_title', '') else p.source_title end,
      source_type = case when v_patch ? 'source_type' then nullif(v_patch ->> 'source_type', '') else p.source_type end,
      source_organization = case when v_patch ? 'source_organization' then nullif(v_patch ->> 'source_organization', '') else p.source_organization end,
      source_reference = case when v_patch ? 'source_reference' then nullif(v_patch ->> 'source_reference', '') else p.source_reference end,
      source_url = case when v_patch ? 'source_url' then nullif(v_patch ->> 'source_url', '') else p.source_url end,
      source_notes = case when v_patch ? 'source_notes' then nullif(v_patch ->> 'source_notes', '') else p.source_notes end,
      copyright_holder = case when v_patch ? 'copyright_holder' then nullif(v_patch ->> 'copyright_holder', '') else p.copyright_holder end,
      copyright_notice = case when v_patch ? 'copyright_notice' then nullif(v_patch ->> 'copyright_notice', '') else p.copyright_notice end,
      license_type = case when v_patch ? 'license_type' then nullif(v_patch ->> 'license_type', '') else p.license_type end,
      license_reference = case when v_patch ? 'license_reference' then nullif(v_patch ->> 'license_reference', '') else p.license_reference end,
      content_edition = case when v_patch ? 'content_edition' then nullif(v_patch ->> 'content_edition', '') else p.content_edition end,
      content_version_label = case when v_patch ? 'content_version_label' then nullif(v_patch ->> 'content_version_label', '') else p.content_version_label end,
      ecclesial_approval_status = case when v_patch ? 'ecclesial_approval_status' then v_patch ->> 'ecclesial_approval_status' else p.ecclesial_approval_status end,
      ecclesial_approval_authority = case when v_patch ? 'ecclesial_approval_authority' then nullif(v_patch ->> 'ecclesial_approval_authority', '') else p.ecclesial_approval_authority end,
      ecclesial_approval_reference = case when v_patch ? 'ecclesial_approval_reference' then nullif(v_patch ->> 'ecclesial_approval_reference', '') else p.ecclesial_approval_reference end,
      reviewed_by = case when v_patch ? 'reviewed_by' then nullif(v_patch ->> 'reviewed_by', '') else p.reviewed_by end,
      reviewed_at = case when v_patch ? 'reviewed_at' then (v_patch ->> 'reviewed_at')::date else p.reviewed_at end,
      metadata = case when v_patch ? 'metadata' then coalesce(v_patch -> 'metadata', p.metadata) else p.metadata end,
      status = 'draft',
      featured = false,
      updated_by = auth.uid()
    where p.id = v_id and p.prayer_code = v_code and p.updated_at = v_expected_updated_at;

    if not found then
      raise exception 'Concurrent edit or missing prayer detected for %', v_code using errcode = '40001';
    end if;
    v_updated := v_updated + 1;
  end loop;

  insert into public.content_import_batches (
    content_type, filename, notes, imported_by, imported_at, total_rows, valid_rows,
    imported_rows, updated_rows, skipped_rows, status, validation_summary,
    conflict_strategy
  ) values (
    'prayer', btrim(_filename), 'staging-only controlled Prayer Library import', auth.uid(), now(),
    jsonb_array_length(_changes), jsonb_array_length(_changes), v_updated, v_updated, 0,
    'Imported', jsonb_build_object('environment', 'staging', 'workbook_checksum', _workbook_checksum,
      'forced_status', 'draft', 'updated_rows', v_updated), 'update_existing'
  ) returning id into v_batch_id;

  return jsonb_build_object('batchId', v_batch_id, 'updated', v_updated, 'skipped', 0,
    'unchanged', 0, 'failed', 0, 'status', 'Imported', 'forcedStatus', 'draft');
end;
$$;

revoke all on function public.apply_staging_prayer_import(text, text, jsonb, text) from public;
grant execute on function public.apply_staging_prayer_import(text, text, jsonb, text) to authenticated;

comment on function public.apply_staging_prayer_import(text, text, jsonb, text) is
  'Approved-staging-only, Super Admin-only, transactional execution boundary for validated update-only prayer imports. Always forces draft.';
