-- RC-1.2.1 Startup Performance Optimization
-- Consolidates AuthContext startup lookups into one authenticated RPC.

create or replace function public.get_current_user_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_role_church_id uuid;
  v_role text;
  v_member public.members%rowtype;
  v_church public.churches%rowtype;
  v_resolved_church_id uuid;
  v_resolved_role text;
  v_is_super_admin boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object(
      'profile', null,
      'role', null,
      'church_id', null,
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

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  v_resolved_church_id := v_profile.church_id;
  v_is_super_admin := public.is_super_admin(v_user_id) or coalesce(v_profile.role = 'super_admin', false);

  if v_is_super_admin then
    v_resolved_role := 'super_admin';
  else
    select ur.church_id, ur.role
    into v_role_church_id, v_role
    from public.user_roles ur
    where ur.user_id = v_user_id
    limit 1;

    if v_role_church_id is not null then
      v_resolved_church_id := v_role_church_id;
    end if;

    if v_role is not null then
      v_resolved_role := v_role;
    end if;

    if v_resolved_church_id is null then
      select *
      into v_member
      from public.members
      where user_id = v_user_id
        and church_id is not null
      limit 1;

      if v_member.church_id is not null then
        v_resolved_church_id := v_member.church_id;
      end if;
    end if;

    if v_resolved_church_id is null then
      select *
      into v_church
      from public.churches
      where created_by = v_user_id
      limit 1;

      if v_church.id is not null then
        v_resolved_church_id := v_church.id;
      end if;
    end if;

    if v_resolved_role is null and v_resolved_church_id is not null then
      v_resolved_role := 'member';
    end if;
  end if;

  if v_member.id is null and v_resolved_church_id is not null then
    select *
    into v_member
    from public.members
    where user_id = v_user_id
      and church_id = v_resolved_church_id
    limit 1;
  end if;

  if v_church.id is null and v_resolved_church_id is not null then
    select *
    into v_church
    from public.churches
    where id = v_resolved_church_id
    limit 1;
  end if;

  return jsonb_build_object(
    'profile', case when v_profile.id is null then null else to_jsonb(v_profile) end,
    'role', v_resolved_role,
    'church_id', v_resolved_church_id,
    'church', case when v_church.id is null then null else to_jsonb(v_church) end,
    'member', case when v_member.id is null then null else to_jsonb(v_member) end,
    'is_super_admin', v_is_super_admin,
    'permissions', jsonb_build_object(
      'is_super_admin', v_is_super_admin,
      'can_view_church_workspace',
        case
          when v_resolved_church_id is null then false
          else public.can_view_church_workspace(v_user_id, v_resolved_church_id)
        end,
      'can_manage_church_workspace',
        case
          when v_resolved_church_id is null then false
          else public.can_manage_church_workspace(v_user_id, v_resolved_church_id)
        end
    )
  );
end;
$$;

grant execute on function public.get_current_user_context() to authenticated;
