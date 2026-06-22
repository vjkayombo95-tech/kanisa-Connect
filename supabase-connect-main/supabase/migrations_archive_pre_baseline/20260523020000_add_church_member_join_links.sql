-- Public church join links use a stable slug while membership creation is resolved server-side.
alter table public.churches
  add column if not exists slug text;

create unique index if not exists churches_slug_unique_idx
  on public.churches (lower(slug))
  where slug is not null;

create or replace function public.make_church_join_slug(_name text, _church_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _base text;
  _candidate text;
  _suffix integer := 1;
begin
  _base := lower(regexp_replace(trim(coalesce(_name, 'church')), '[^a-zA-Z0-9]+', '-', 'g'));
  _base := trim(both '-' from _base);

  if _base = '' then
    _base := 'church';
  end if;

  _candidate := _base;
  while exists (
    select 1
    from public.churches c
    where lower(c.slug) = lower(_candidate)
      and (_church_id is null or c.id <> _church_id)
  ) loop
    _suffix := _suffix + 1;
    _candidate := _base || '-' || _suffix::text;
  end loop;

  return _candidate;
end;
$$;

do $$
declare
  _church record;
begin
  for _church in
    select c.id, c.name
    from public.churches c
    where c.slug is null or trim(c.slug) = ''
    order by c.created_at, c.id
  loop
    update public.churches
    set slug = public.make_church_join_slug(_church.name, _church.id)
    where id = _church.id;
  end loop;
end;
$$;

create or replace function public.set_church_join_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.make_church_join_slug(new.name, new.id);
  else
    new.slug := lower(regexp_replace(trim(new.slug), '[^a-zA-Z0-9]+', '-', 'g'));
    new.slug := trim(both '-' from new.slug);
  end if;

  if new.slug = '' then
    new.slug := public.make_church_join_slug(new.name, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists set_church_join_slug_before_write on public.churches;
create trigger set_church_join_slug_before_write
before insert or update of slug on public.churches
for each row execute function public.set_church_join_slug();

alter table public.churches
  alter column slug set not null;

create or replace function public.get_public_join_church(_slug text)
returns table (
  id uuid,
  name text,
  code text,
  slug text,
  logo_url text,
  metadata jsonb
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  _has_metadata boolean;
  _has_logo_url boolean;
  _has_status boolean;
  _metadata_expression text;
  _logo_expression text;
  _status_condition text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'metadata'
  )
  into _has_metadata;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'logo_url'
  )
  into _has_logo_url;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'status'
  )
  into _has_status;

  _metadata_expression := case
    when _has_metadata then 'coalesce(c.metadata, ''{}''::jsonb)'
    else '''{}''::jsonb'
  end;
  _logo_expression := case
    when _has_logo_url then 'c.logo_url'
    else 'null::text'
  end;
  _status_condition := case
    when _has_status then 'and c.status = ''active'''
    else ''
  end;

  return query execute format(
    'select c.id, c.name, c.code, c.slug, %s, %s
     from public.churches c
     where lower(c.slug) = lower(trim($1))
       %s
     limit 1',
    _logo_expression,
    _metadata_expression,
    _status_condition
  )
  using _slug;
end;
$$;

create or replace function public.join_church_workspace(
  _slug text,
  _full_name text,
  _email text default null,
  _phone text default null,
  _gender text default null,
  _photo_url text default null,
  _community_id uuid default null,
  _ministry_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _church public.churches%rowtype;
  _member_id uuid;
  _normalized_email text := nullif(lower(trim(coalesce(_email, ''))), '');
  _registration_enabled boolean := true;
  _has_metadata boolean;
  _has_status boolean;
  _status_condition text;
begin
  if _user_id is null then
    raise exception 'Please sign in before joining this church.';
  end if;

  if nullif(trim(_slug), '') is null then
    raise exception 'This church join link is invalid.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'status'
  )
  into _has_status;

  _status_condition := case
    when _has_status then 'and c.status = ''active'''
    else ''
  end;

  execute format(
    'select c.*
     from public.churches c
     where lower(c.slug) = lower(trim($1))
       %s
     limit 1',
    _status_condition
  )
  into _church
  using _slug;

  if _church.id is null then
    raise exception 'This church join link is invalid or no longer active.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'metadata'
  )
  into _has_metadata;

  if _has_metadata then
    execute
      'select coalesce((metadata ->> ''public_registration_enabled'')::boolean, true)
       from public.churches
       where id = $1'
    into _registration_enabled
    using _church.id;
  end if;

  if not _registration_enabled then
    raise exception 'Public registration is not currently available for this church.';
  end if;

  if nullif(trim(_full_name), '') is null then
    raise exception 'Your full name is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || _church.id::text, 0));

  if exists (
    select 1
    from public.members m
    where m.user_id = _user_id
      and m.church_id = _church.id
  ) then
    raise exception 'You are already registered with this church.';
  end if;

  if exists (
    select 1
    from public.members m
    where m.user_id = _user_id
      and m.church_id <> _church.id
  ) then
    raise exception 'Your account is already linked to another church workspace.';
  end if;

  if _normalized_email is not null and exists (
    select 1
    from public.members m
    where m.church_id = _church.id
      and lower(coalesce(m.email, '')) = _normalized_email
  ) then
    raise exception 'A member with this email is already registered with this church.';
  end if;

  if nullif(trim(coalesce(_phone, '')), '') is not null and exists (
    select 1
    from public.members m
    where m.church_id = _church.id
      and m.phone = trim(_phone)
  ) then
    raise exception 'A member with this phone number is already registered with this church.';
  end if;

  if _community_id is not null and not exists (
    select 1 from public.communities c
    where c.id = _community_id and c.church_id = _church.id
  ) then
    raise exception 'The selected Jumuiya does not belong to this church.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(_ministry_ids, array[]::uuid[])) as requested_id
    where not exists (
      select 1 from public.ministries m
      where m.id = requested_id and m.church_id = _church.id
    )
  ) then
    raise exception 'One or more selected ministries do not belong to this church.';
  end if;

  insert into public.members (
    full_name,
    email,
    phone,
    gender,
    photo_url,
    church_id,
    user_id,
    status
  )
  values (
    trim(_full_name),
    _normalized_email,
    nullif(trim(coalesce(_phone, '')), ''),
    nullif(trim(coalesce(_gender, '')), '')::public.gender_type,
    nullif(trim(coalesce(_photo_url, '')), ''),
    _church.id,
    _user_id,
    'active'
  )
  returning id into _member_id;

  insert into public.user_roles (user_id, church_id, role)
  values (_user_id, _church.id, 'member')
  on conflict do nothing;

  if _community_id is not null then
    insert into public.member_communities (community_id, member_id)
    values (_community_id, _member_id)
    on conflict do nothing;
  end if;

  insert into public.member_ministries (member_id, ministry_id)
  select _member_id, ministry_id
  from unnest(coalesce(_ministry_ids, array[]::uuid[])) as ministry_id
  on conflict do nothing;

  return jsonb_build_object(
    'success', true,
    'member_id', _member_id,
    'church_id', _church.id,
    'church_name', _church.name,
    'slug', _church.slug
  );
end;
$$;

revoke all on function public.make_church_join_slug(text, uuid) from public;
revoke all on function public.get_public_join_church(text) from public;
revoke all on function public.join_church_workspace(text, text, text, text, text, text, uuid, uuid[]) from public;

grant execute on function public.get_public_join_church(text) to anon, authenticated;
grant execute on function public.join_church_workspace(text, text, text, text, text, text, uuid, uuid[]) to authenticated;
