create or replace function public.ensure_church_registration_code(_church_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
begin
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = _church_id
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
  ) then
    raise exception 'Not allowed to manage this church registration link';
  end if;

  select c.code
  into existing_code
  from public.churches c
  where c.id = _church_id;

  if existing_code is null or btrim(existing_code) = '' then
    existing_code := public.generate_church_code();

    update public.churches
    set code = existing_code
    where id = _church_id;
  end if;

  return existing_code;
end;
$$;

create or replace function public.set_public_registration_enabled(_church_id uuid, _enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_metadata jsonb;
begin
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = _church_id
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
  ) then
    raise exception 'Not allowed to update this church registration setting';
  end if;

  update public.churches
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('public_registration_enabled', _enabled)
  where id = _church_id
  returning metadata into updated_metadata;

  return updated_metadata;
end;
$$;

grant execute on function public.ensure_church_registration_code(uuid) to authenticated;
grant execute on function public.set_public_registration_enabled(uuid, boolean) to authenticated;
