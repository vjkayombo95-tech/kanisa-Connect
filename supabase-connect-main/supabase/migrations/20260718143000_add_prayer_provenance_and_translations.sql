-- Add traceable provenance, rights, human-readable edition labels, and stable
-- translation families to the existing tenant-aware Catholic Prayer Library.

create extension if not exists pgcrypto;

alter table public.content_prayers
  add column if not exists source_title text,
  add column if not exists source_type text,
  add column if not exists source_organization text,
  add column if not exists source_reference text,
  add column if not exists source_url text,
  add column if not exists source_notes text,
  add column if not exists copyright_holder text,
  add column if not exists copyright_notice text,
  add column if not exists license_type text,
  add column if not exists license_reference text,
  add column if not exists content_edition text,
  add column if not exists content_version_label text,
  add column if not exists ecclesial_approval_status text not null default 'pending',
  add column if not exists ecclesial_approval_authority text,
  add column if not exists ecclesial_approval_reference text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at date,
  add column if not exists translation_group_id uuid default gen_random_uuid(),
  add column if not exists translation_key text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'content_prayers_source_type_check') then
    alter table public.content_prayers add constraint content_prayers_source_type_check check (
      source_type is null or source_type in (
        'roman_missal', 'catechism', 'bishops_conference', 'diocesan_publication',
        'parish_publication', 'approved_prayer_book', 'scripture', 'public_domain',
        'original_parish_content', 'user_submitted', 'other'
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'content_prayers_license_type_check') then
    alter table public.content_prayers add constraint content_prayers_license_type_check check (
      license_type is null or license_type in (
        'public_domain', 'permission_granted', 'licensed', 'attribution_required',
        'internal_church_use', 'copyright_restricted', 'unknown'
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'content_prayers_ecclesial_approval_status_check') then
    alter table public.content_prayers add constraint content_prayers_ecclesial_approval_status_check check (
      ecclesial_approval_status in ('pending', 'under_review', 'approved', 'rejected', 'revision_required')
    );
  end if;
end $$;

-- This is a structural/metadata migration. Avoid updated_at churn and technical
-- content_versions entries for the harmless backfill, while leaving both triggers
-- enabled for every subsequent application edit.
alter table public.content_prayers disable trigger set_content_prayers_updated_at;
alter table public.content_prayers disable trigger capture_content_prayer_version;

update public.content_prayers
set
  translation_group_id = coalesce(translation_group_id, gen_random_uuid()),
  translation_key = case
    when translation_key is null
      and prayer_code is not null
      and coalesce(metadata ->> 'seeded_title_only', 'false') = 'true'
    then prayer_code
    else translation_key
  end,
  source_notes = coalesce(source_notes, nullif(btrim(metadata ->> 'source_notes'), '')),
  reviewed_by = coalesce(reviewed_by, nullif(btrim(metadata ->> 'reviewed_by'), '')),
  reviewed_at = coalesce(
    reviewed_at,
    case when metadata ->> 'review_date' ~ '^\d{4}-\d{2}-\d{2}$' then (metadata ->> 'review_date')::date end
  ),
  ecclesial_approval_status = coalesce(
    case when metadata ->> 'ecclesial_approval_status' in ('pending', 'under_review', 'approved', 'rejected', 'revision_required')
      then metadata ->> 'ecclesial_approval_status' end,
    ecclesial_approval_status,
    'pending'
  )
where translation_group_id is null
   or (translation_key is null and prayer_code is not null and coalesce(metadata ->> 'seeded_title_only', 'false') = 'true')
   or (source_notes is null and nullif(btrim(metadata ->> 'source_notes'), '') is not null)
   or (reviewed_by is null and nullif(btrim(metadata ->> 'reviewed_by'), '') is not null)
   or (reviewed_at is null and metadata ->> 'review_date' ~ '^\d{4}-\d{2}-\d{2}$')
   or (
     metadata ->> 'ecclesial_approval_status' in ('pending', 'under_review', 'approved', 'rejected', 'revision_required')
     and ecclesial_approval_status is distinct from metadata ->> 'ecclesial_approval_status'
   );

alter table public.content_prayers
  alter column translation_group_id set default gen_random_uuid(),
  alter column translation_group_id set not null;

alter table public.content_prayers enable trigger set_content_prayers_updated_at;
alter table public.content_prayers enable trigger capture_content_prayer_version;

create index if not exists idx_content_prayers_translation_group on public.content_prayers(translation_group_id);
create index if not exists idx_content_prayers_translation_key on public.content_prayers(translation_key);
create unique index if not exists content_prayers_translation_group_language_key
  on public.content_prayers(translation_group_id, language_id) where language_id is not null;
create index if not exists idx_content_prayers_source_type on public.content_prayers(source_type);
create index if not exists idx_content_prayers_license_type on public.content_prayers(license_type);
create index if not exists idx_content_prayers_ecclesial_approval_status on public.content_prayers(ecclesial_approval_status);

create or replace function public.validate_content_prayer_translation_family()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family public.content_prayers%rowtype;
  v_parent_group uuid;
  v_family_parent_group uuid;
begin
  select * into v_family
  from public.content_prayers
  where translation_group_id = new.translation_group_id
    and id <> new.id
  order by created_at, id
  limit 1;

  if found then
    if new.prayer_type is distinct from v_family.prayer_type then
      raise exception 'Translation family cannot mix prayer types' using errcode = '23514';
    end if;
    if new.is_global is distinct from v_family.is_global
      or new.church_id is distinct from v_family.church_id then
      raise exception 'Translation family cannot cross global or parish ownership' using errcode = '23514';
    end if;
    if new.translation_key is null then
      new.translation_key := v_family.translation_key;
    elsif new.translation_key is distinct from v_family.translation_key then
      raise exception 'Translation key must be consistent within a translation family' using errcode = '23514';
    end if;
  end if;

  if new.translation_key is not null and exists (
    select 1 from public.content_prayers p
    where p.translation_key = new.translation_key
      and p.translation_group_id <> new.translation_group_id
      and p.id <> new.id
  ) then
    raise exception 'Translation key already belongs to another translation family' using errcode = '23505';
  end if;

  if new.parent_prayer_id is not null then
    select translation_group_id into v_parent_group
    from public.content_prayers where id = new.parent_prayer_id;

    if v_parent_group = new.translation_group_id then
      raise exception 'A prayer translation family cannot also be its parent family' using errcode = '23514';
    end if;

    select parent.translation_group_id into v_family_parent_group
    from public.content_prayers variant
    join public.content_prayers parent on parent.id = variant.parent_prayer_id
    where variant.translation_group_id = new.translation_group_id
      and variant.id <> new.id
      and variant.parent_prayer_id is not null
    limit 1;

    if v_family_parent_group is not null and v_parent_group is distinct from v_family_parent_group then
      raise exception 'Translated child prayers must use parents from the same parent translation family' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_content_prayer_translation_family() from public;

drop trigger if exists validate_content_prayer_translation_family on public.content_prayers;
create trigger validate_content_prayer_translation_family
before insert or update of translation_group_id, translation_key, language_id, prayer_type, is_global, church_id, parent_prayer_id
on public.content_prayers
for each row execute function public.validate_content_prayer_translation_family();

comment on column public.content_prayers.prayer_code is
  'Globally unique row identifier used by controlled imports; existing values remain stable. Future translations use language-specific codes.';
comment on column public.content_prayers.translation_key is
  'Human-stable conceptual prayer key shared by language variants; it is not the row identifier.';
comment on column public.content_prayers.translation_group_id is
  'Stable UUID joining separate language rows for one conceptual prayer while preserving per-language review, rights, and publication.';
comment on column public.content_prayers.content_version_label is
  'Human-entered label for the source/content edition; distinct from content_versions technical database audit history.';
comment on table public.content_versions is
  'Technical audit snapshots of content edits. Human source or edition labels belong in content_prayers.content_version_label.';
