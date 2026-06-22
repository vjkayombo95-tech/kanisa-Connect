create or replace function public.get_public_registration_church(
  _church_code text default null,
  _church_id uuid default null
)
returns table (
  id uuid,
  name text,
  code text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  has_metadata_column boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'metadata'
  )
  into has_metadata_column;

  if has_metadata_column then
    return query
    select c.id, c.name, c.code, coalesce(c.metadata, '{}'::jsonb) as metadata
    from public.churches c
    where (
      _church_code is not null
      and btrim(_church_code) <> ''
      and c.code = btrim(_church_code)
    )
    or (
      _church_id is not null
      and c.id = _church_id
    )
    limit 1;
  else
    return query
    select c.id, c.name, c.code, null::jsonb as metadata
    from public.churches c
    where (
      _church_code is not null
      and btrim(_church_code) <> ''
      and c.code = btrim(_church_code)
    )
    or (
      _church_id is not null
      and c.id = _church_id
    )
    limit 1;
  end if;
end;
$$;

create or replace function public.get_public_registration_communities(_church_id uuid)
returns table (
  id uuid,
  name text
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name
  from public.communities c
  where c.church_id = _church_id
  order by c.name;
$$;

create or replace function public.get_public_registration_ministries(_church_id uuid)
returns table (
  id uuid,
  name text
)
language sql
security definer
set search_path = public
as $$
  select m.id, m.name
  from public.ministries m
  where m.church_id = _church_id
  order by m.name;
$$;

create or replace function public.assign_default_member_role(_user_id uuid, _church_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id is null or _church_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and church_id = _church_id
  ) then
    insert into public.user_roles (user_id, church_id, role)
    values (_user_id, _church_id, 'member');
  end if;
end;
$$;

create or replace function public.complete_public_registration(
  _church_id uuid,
  _full_name text,
  _email text,
  _phone text,
  _gender text,
  _photo_url text,
  _community_id uuid default null,
  _ministry_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _member_id uuid;
  _church_name text;
  _normalized_email text;
  has_community_members_table boolean;
  has_member_communities_table boolean;
  has_ministry_members_table boolean;
  has_member_ministries_table boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  _normalized_email := lower(trim(coalesce(_email, '')));

  if _church_id is null or coalesce(trim(_full_name), '') = '' or _normalized_email = '' then
    return jsonb_build_object('success', false, 'error', 'Missing required registration fields');
  end if;

  select name into _church_name
  from public.churches
  where id = _church_id;

  if _church_name is null then
    return jsonb_build_object('success', false, 'error', 'Church not found');
  end if;

  if exists (
    select 1
    from public.members
    where church_id = _church_id
      and lower(coalesce(email, '')) = _normalized_email
  ) then
    return jsonb_build_object('success', false, 'error', 'A member with this email already exists for this church');
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
    nullif(trim(coalesce(_gender, '')), ''),
    nullif(trim(coalesce(_photo_url, '')), ''),
    _church_id,
    auth.uid(),
    'active'
  )
  returning id into _member_id;

  select to_regclass('public.community_members') is not null into has_community_members_table;
  select to_regclass('public.member_communities') is not null into has_member_communities_table;
  select to_regclass('public.ministry_members') is not null into has_ministry_members_table;
  select to_regclass('public.member_ministries') is not null into has_member_ministries_table;

  if _community_id is not null then
    if has_community_members_table then
      insert into public.community_members (community_id, member_id)
      values (_community_id, _member_id)
      on conflict do nothing;
    elsif has_member_communities_table then
      insert into public.member_communities (community_id, member_id)
      values (_community_id, _member_id)
      on conflict do nothing;
    end if;
  end if;

  if coalesce(array_length(_ministry_ids, 1), 0) > 0 then
    if has_ministry_members_table then
      insert into public.ministry_members (member_id, ministry_id)
      select _member_id, ministry_id
      from unnest(_ministry_ids) as ministry_id
      on conflict do nothing;
    elsif has_member_ministries_table then
      insert into public.member_ministries (member_id, ministry_id)
      select _member_id, ministry_id
      from unnest(_ministry_ids) as ministry_id
      on conflict do nothing;
    end if;
  end if;

  perform public.assign_default_member_role(auth.uid(), _church_id);

  return jsonb_build_object(
    'success', true,
    'member_id', _member_id,
    'church_id', _church_id,
    'church_name', _church_name
  );
end;
$$;

grant execute on function public.get_public_registration_church(text, uuid) to anon, authenticated;
grant execute on function public.get_public_registration_communities(uuid) to anon, authenticated;
grant execute on function public.get_public_registration_ministries(uuid) to anon, authenticated;
grant execute on function public.assign_default_member_role(uuid, uuid) to authenticated;
grant execute on function public.complete_public_registration(uuid, text, text, text, text, text, uuid, uuid[]) to authenticated;
