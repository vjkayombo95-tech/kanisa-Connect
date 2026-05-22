create or replace function public.update_community_leadership(
  _community_id uuid,
  _role_field text,
  _member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _church_id uuid;
  _allowed_fields text[] := array[
    'mwenyekiti_id',
    'makamu_mwenyekiti_id',
    'mweka_hazina_id',
    'katibu_id'
  ];
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _community_id is null then
    return jsonb_build_object('success', false, 'error', 'Community is required');
  end if;

  if _role_field is null or not (_role_field = any(_allowed_fields)) then
    return jsonb_build_object('success', false, 'error', 'Invalid leadership role');
  end if;

  select church_id
  into _church_id
  from public.communities
  where id = _community_id;

  if _church_id is null then
    return jsonb_build_object('success', false, 'error', 'Community not found');
  end if;

  if not (public.is_church_admin(auth.uid(), _church_id) or public.is_super_admin(auth.uid())) then
    return jsonb_build_object('success', false, 'error', 'You do not have permission to update this community');
  end if;

  if _member_id is not null and not exists (
    select 1
    from public.members
    where id = _member_id
      and church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Selected member does not belong to this church');
  end if;

  if _role_field = 'mwenyekiti_id' then
    update public.communities
    set mwenyekiti_id = _member_id,
        leader_id = _member_id
    where id = _community_id;
  elsif _role_field = 'makamu_mwenyekiti_id' then
    update public.communities
    set makamu_mwenyekiti_id = _member_id
    where id = _community_id;
  elsif _role_field = 'mweka_hazina_id' then
    update public.communities
    set mweka_hazina_id = _member_id
    where id = _community_id;
  elsif _role_field = 'katibu_id' then
    update public.communities
    set katibu_id = _member_id
    where id = _community_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.update_community_leadership(uuid, text, uuid) to authenticated;
