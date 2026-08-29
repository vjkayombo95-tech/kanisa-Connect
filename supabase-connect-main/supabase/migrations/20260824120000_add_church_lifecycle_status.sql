-- Add the church lifecycle column expected by the super-admin approval UI.
-- Existing production/staging churches predate this column and remain active.

alter table public.churches
  add column if not exists status text;

alter table public.churches
  alter column status set default 'active';

update public.churches
set status = 'active'
where status is null;

alter table public.churches
  alter column status set not null;

alter table public.churches
  drop constraint if exists churches_status_check,
  add constraint churches_status_check
    check (status in ('pending', 'active', 'inactive', 'suspended'));

comment on column public.churches.status is
  'Church lifecycle for platform review and public discovery. Only active churches are publicly discoverable.';

drop function if exists public.get_public_registration_church(text, uuid);
create or replace function public.get_public_registration_church(
  _church_code text default null,
  _church_id uuid default null
)
returns table(id uuid, name text, code text, church_code text, short_code text, metadata jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  has_metadata_column boolean;
  v_code text := nullif(trim(coalesce(_church_code, '')), '');
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'metadata'
  ) into has_metadata_column;

  return query execute format(
    'select c.id, c.name, c.code, c.church_code, c.short_code, %s as metadata
     from public.churches c
     where (
       (
         $1 is not null
         and (
           upper(c.church_code) = upper($1)
           or upper(c.short_code) = upper(regexp_replace($1, ''[^A-Za-z0-9]'', '''', ''g''))
           or upper(coalesce(c.code, '''')) = upper($1)
           or c.name ilike $1
         )
       )
       or ($2 is not null and c.id = $2)
     )
     and c.status = ''active''
     order by case when upper(c.short_code) = upper(regexp_replace(coalesce($1, ''''), ''[^A-Za-z0-9]'', '''', ''g'')) then 0 else 1 end
     limit 1',
    case when has_metadata_column then 'coalesce(c.metadata, ''{}''::jsonb)' else 'null::jsonb' end
  )
  using v_code, _church_id;
end;
$$;

grant execute on function public.get_public_registration_church(text, uuid) to anon, authenticated;
