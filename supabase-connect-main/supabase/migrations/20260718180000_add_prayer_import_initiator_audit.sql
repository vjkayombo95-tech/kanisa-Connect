-- Additive actor attribution for browser-initiated Prayer Library imports.
-- The browser is authenticated separately; only the service role may call the
-- actor-aware overload, which derives identity snapshots from trusted tables.

alter table public.content_import_batches
  add column if not exists initiated_by_user_uuid uuid references auth.users(id) on delete set null,
  add column if not exists initiated_by_email text,
  add column if not exists initiated_by_display_name text,
  add column if not exists executed_by text;

create index if not exists idx_content_import_batches_initiated_by
  on public.content_import_batches(initiated_by_user_uuid, created_at desc);

create or replace function public.set_prayer_import_executor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.content_type = 'prayer' and new.executed_by is null then
    new.executed_by := 'service_role';
  end if;
  return new;
end;
$$;

drop trigger if exists set_prayer_import_executor on public.content_import_batches;
create trigger set_prayer_import_executor
before insert on public.content_import_batches
for each row execute function public.set_prayer_import_executor();

update public.content_import_batches
set executed_by = 'service_role'
where content_type = 'prayer'
  and executed_by is null
  and validation_summary ->> 'imported_via' = 'service_role_cli';

create or replace function public.apply_staging_prayer_import(
  _filename text,
  _workbook_checksum text,
  _changes jsonb,
  _confirmation text,
  _initiated_by_user_uuid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_batch_id uuid;
  v_email text;
  v_display_name text;
  v_issuer text := coalesce(auth.jwt() ->> 'iss', '');
  v_request_headers jsonb := case
    when nullif(current_setting('request.headers', true), '') is null then '{}'::jsonb
    else current_setting('request.headers', true)::jsonb
  end;
  v_host text;
begin
  v_host := lower(split_part(coalesce(v_request_headers ->> 'host', ''), ':', 1));

  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role execution required' using errcode = '42501';
  end if;
  if v_host <> 'nunfrjcuimaytydnaqtt.supabase.co'
    and v_issuer not like '%nunfrjcuimaytydnaqtt.supabase.co/auth/v1'
  then
    raise exception 'Prayer imports are restricted to the approved staging project' using errcode = '42501';
  end if;
  if _initiated_by_user_uuid is null then
    raise exception 'An initiating Super Admin is required for browser imports' using errcode = '22023';
  end if;
  if not (
    public.is_platform_super_admin(_initiated_by_user_uuid)
    or public.is_super_admin(_initiated_by_user_uuid)
  ) then
    raise exception 'Initiating user is not a Super Admin' using errcode = '42501';
  end if;

  select u.email,
    coalesce(
      nullif(btrim(p.full_name), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(u.email), '')
    )
  into v_email, v_display_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = _initiated_by_user_uuid;

  if v_email is null then
    raise exception 'Initiating user identity was not found' using errcode = '42501';
  end if;

  v_result := public.apply_staging_prayer_import(
    _filename,
    _workbook_checksum,
    _changes,
    _confirmation
  );
  v_batch_id := (v_result ->> 'batchId')::uuid;

  update public.content_import_batches
  set imported_by = _initiated_by_user_uuid,
      initiated_by_user_uuid = _initiated_by_user_uuid,
      initiated_by_email = v_email,
      initiated_by_display_name = v_display_name,
      executed_by = 'service_role',
      validation_summary = coalesce(validation_summary, '{}'::jsonb)
        || jsonb_build_object(
          'imported_via', 'browser_super_admin',
          'initiated_by_user_uuid', _initiated_by_user_uuid,
          'executed_by', 'service_role'
        )
  where id = v_batch_id;

  if not found then
    raise exception 'Import batch history was not recorded' using errcode = 'P0001';
  end if;

  return v_result || jsonb_build_object(
    'initiatedByUserUuid', _initiated_by_user_uuid,
    'initiatedByEmail', v_email,
    'initiatedByDisplayName', v_display_name,
    'executedBy', 'service_role'
  );
end;
$$;

revoke all on function public.apply_staging_prayer_import(text, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.apply_staging_prayer_import(text, text, jsonb, text, uuid) to service_role;

-- Browser clients must use the authenticated Edge Function; the four-argument
-- overload remains available to the controlled service-role CLI only.
revoke execute on function public.apply_staging_prayer_import(text, text, jsonb, text) from authenticated;
grant execute on function public.apply_staging_prayer_import(text, text, jsonb, text) to service_role;

comment on function public.apply_staging_prayer_import(text, text, jsonb, text, uuid) is
  'Service-role-only browser import overload. Validates the initiating Super Admin and atomically records trusted actor attribution.';
