-- Slice 2: server-validated active church context.
--
-- The legacy get_current_user_context() RPC remains intact for compatibility.
-- This RPC accepts a requested church, validates it against auth.uid(), and
-- falls back deterministically without trusting browser state.

create or replace function public.get_current_user_context_for_church(
  _requested_church_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_member public.members%rowtype;
  v_church public.churches%rowtype;
  v_church_id uuid;
  v_legacy_church_id uuid;
  v_role_church_id uuid;
  v_role text;
  v_roles text[] := array[]::text[];
  v_is_super_admin boolean := false;
  v_available_churches jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object(
      'profile', null,
      'role', null,
      'roles', '[]'::jsonb,
      'church_id', null,
      'active_church_id', null,
      'available_churches', '[]'::jsonb,
      'church', null,
      'member', null,
      'is_super_admin', false,
      'permissions', jsonb_build_object(
        'is_super_admin', false,
        'can_view_church_workspace', false,
        'can_manage_church_workspace', false
      )
    );
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  v_is_super_admin := public.is_super_admin(v_user_id)
    or coalesce(v_profile.role = 'super_admin', false);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'membership_id', cm.id,
        'church_id', cm.church_id,
        'church_name', c.name,
        'church_code', c.church_code,
        'status', cm.status::text,
        'is_primary', cm.is_primary,
        'joined_at', cm.joined_at,
        'roles', role_context.roles,
        'baseline_member', member_context.baseline_member
      )
      order by cm.is_primary desc, cm.joined_at, cm.id
    ),
    '[]'::jsonb
  )
  into v_available_churches
  from public.church_memberships cm
  join public.churches c on c.id = cm.church_id
  left join lateral (
    select coalesce(array_agg(role order by role), array[]::text[]) as roles
    from (
      select distinct lower(ur.role::text) as role
      from public.user_roles ur
      where ur.user_id = cm.user_id
        and ur.church_id = cm.church_id
        and (ur.membership_id = cm.id or ur.membership_id is null)
        and nullif(trim(ur.role::text), '') is not null
    ) role_rows
  ) role_context on true
  left join lateral (
    select exists (
      select 1
      from public.members m
      where m.user_id = cm.user_id
        and m.church_id = cm.church_id
        and (m.membership_id = cm.id or m.membership_id is null)
        and lower(coalesce(m.status, 'active')) in ('active', 'approved')
    ) as baseline_member
  ) member_context on true
  where cm.user_id = v_user_id
    and cm.status = 'active';

  select ur.church_id into v_role_church_id
  from public.user_roles ur
  where ur.user_id = v_user_id
    and ur.church_id is not null
  order by (ur.church_id = v_profile.church_id) desc,
    ur.created_at nulls last,
    ur.id
  limit 1;

  v_legacy_church_id := coalesce(v_role_church_id, v_profile.church_id);

  if v_legacy_church_id is null then
    select m.church_id into v_legacy_church_id
    from public.members m
    where m.user_id = v_user_id
      and m.church_id is not null
    order by (m.church_id = v_profile.church_id) desc,
      m.created_at nulls last,
      m.id
    limit 1;
  end if;

  if v_legacy_church_id is null then
    select c.id into v_legacy_church_id
    from public.churches c
    where c.created_by = v_user_id
    order by c.created_at nulls last, c.id
    limit 1;
  end if;

  if _requested_church_id is not null
    and exists (
      select 1
      from public.church_memberships cm
      where cm.user_id = v_user_id
        and cm.church_id = _requested_church_id
        and cm.status = 'active'
    )
  then
    v_church_id := _requested_church_id;
  end if;

  if v_church_id is null then
    select cm.church_id into v_church_id
    from public.church_memberships cm
    where cm.user_id = v_user_id
      and cm.status = 'active'
      and cm.is_primary
    order by cm.joined_at, cm.id
    limit 1;
  end if;

  if v_church_id is null
    and v_legacy_church_id is not null
    and exists (
      select 1
      from public.church_memberships cm
      where cm.user_id = v_user_id
        and cm.church_id = v_legacy_church_id
        and cm.status = 'active'
    )
  then
    v_church_id := v_legacy_church_id;
  end if;

  if v_church_id is null then
    select cm.church_id into v_church_id
    from public.church_memberships cm
    where cm.user_id = v_user_id
      and cm.status = 'active'
    order by cm.is_primary desc, cm.joined_at, cm.id
    limit 1;
  end if;

  -- Backward compatibility only: if canonical memberships are not populated for
  -- a legacy single-church user yet, preserve the old resolved church.
  if v_church_id is null then
    v_church_id := v_legacy_church_id;
  end if;

  if v_is_super_admin then
    v_role := 'super_admin';
    v_roles := array['super_admin'];
  elsif v_church_id is not null then
    select coalesce(array_agg(distinct lower(ur.role::text)), array[]::text[])
    into v_roles
    from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.church_id = v_church_id
      and nullif(trim(ur.role::text), '') is not null;

    if exists (
      select 1
      from public.members m
      where m.user_id = v_user_id
        and m.church_id = v_church_id
        and lower(coalesce(m.status, 'active')) in ('active', 'approved')
    ) and not ('member' = any(v_roles)) then
      v_roles := array_append(v_roles, 'member');
    end if;

    select lower(ur.role::text) into v_role
    from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.church_id = v_church_id
      and nullif(trim(ur.role::text), '') is not null
    order by (lower(ur.role::text) = 'member'),
      ur.created_at nulls last,
      ur.id
    limit 1;

    v_role := coalesce(v_role, 'member');
  end if;

  if v_church_id is not null then
    select * into v_member
    from public.members
    where user_id = v_user_id
      and church_id = v_church_id
    order by (lower(coalesce(status, 'active')) in ('active', 'approved')) desc,
      created_at nulls last,
      id
    limit 1;

    select * into v_church
    from public.churches
    where id = v_church_id
    limit 1;
  end if;

  return jsonb_build_object(
    'profile', case when v_profile.id is null then null else to_jsonb(v_profile) end,
    'role', v_role,
    'roles', to_jsonb(v_roles),
    'church_id', v_church_id,
    'active_church_id', v_church_id,
    'available_churches', v_available_churches,
    'church', case when v_church.id is null then null else to_jsonb(v_church) end,
    'member', case when v_member.id is null then null else to_jsonb(v_member) end,
    'is_super_admin', v_is_super_admin,
    'permissions', jsonb_build_object(
      'is_super_admin', v_is_super_admin,
      'can_view_church_workspace',
        case when v_church_id is null then false else public.can_view_church_workspace(v_user_id, v_church_id) end,
      'can_manage_church_workspace',
        case when v_church_id is null then false else public.can_manage_church_workspace(v_user_id, v_church_id) end
    )
  );
end;
$$;

comment on function public.get_current_user_context_for_church(uuid) is
  'Slice 2 active-church context RPC. requested_church_id is a preference only; auth.uid() and active canonical membership determine the returned church context.';

revoke all on function public.get_current_user_context_for_church(uuid)
  from public, anon, authenticated;
grant execute on function public.get_current_user_context_for_church(uuid)
  to authenticated;
