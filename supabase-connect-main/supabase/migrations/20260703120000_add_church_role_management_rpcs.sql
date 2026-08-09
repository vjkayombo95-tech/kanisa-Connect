-- Allow church admins to manage church-scoped roles without opening direct
-- table writes through RLS.

alter table public.user_roles
  add column if not exists created_at timestamptz not null default now();

create or replace function public.can_manage_church_roles(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and _church_id is not null
    and (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.church_id = _church_id
          and lower(coalesce(ur.role::text, '')) in ('church_admin', 'admin')
      )
      or exists (
        select 1
        from public.churches c
        where c.id = _church_id
          and (_user_id = c.owner_id or _user_id = c.created_by)
      )
      or public.is_platform_super_admin(_user_id)
      or public.is_super_admin(_user_id)
    );
$$;

create or replace function public.get_church_role_assignments(_church_id uuid)
returns table (
  id uuid,
  user_id uuid,
  church_id uuid,
  role text,
  created_at timestamptz,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ur.id,
    ur.user_id,
    ur.church_id,
    ur.role::text,
    ur.created_at,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(m.full_name), '')) as full_name
  from public.user_roles ur
  left join public.profiles p on p.id = ur.user_id
  left join public.members m on m.user_id = ur.user_id and m.church_id = ur.church_id
  where ur.church_id = _church_id
    and public.can_manage_church_roles(auth.uid(), _church_id)
  order by ur.created_at desc;
$$;

create or replace function public.assign_church_member_role(
  _church_id uuid,
  _user_id uuid,
  _role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(nullif(trim(coalesce(_role, '')), ''));
  v_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if _church_id is null or _user_id is null or v_role is null then
    raise exception 'Missing role assignment fields'
      using errcode = '22023';
  end if;

  if v_role not in ('church_admin', 'pastor', 'secretary', 'treasurer', 'member') then
    raise exception 'Unsupported church role: %', v_role
      using errcode = '22023';
  end if;

  if not public.can_manage_church_roles(auth.uid(), _church_id) then
    raise exception 'You do not have permission to manage roles for this church'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.members m
    where m.church_id = _church_id
      and m.user_id = _user_id
      and coalesce(m.status, 'active') = 'active'
  ) then
    raise exception 'This member must have an active linked account in this church'
      using errcode = '42501';
  end if;

  select ur.id into v_role_id
  from public.user_roles ur
  where ur.user_id = _user_id
    and ur.church_id = _church_id
  limit 1
  for update;

  if v_role_id is null then
    insert into public.user_roles (user_id, church_id, role)
    values (_user_id, _church_id, v_role)
    returning id into v_role_id;
  else
    update public.user_roles
    set role = v_role
    where id = v_role_id;
  end if;

  return jsonb_build_object('success', true, 'id', v_role_id, 'role', v_role);
end;
$$;

create or replace function public.remove_church_member_role(_role_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_roles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if _role_id is null then
    raise exception 'Role assignment is required'
      using errcode = '22023';
  end if;

  select * into v_role
  from public.user_roles
  where id = _role_id
  for update;

  if v_role.id is null then
    raise exception 'Role assignment was not found'
      using errcode = 'P0002';
  end if;

  if not public.can_manage_church_roles(auth.uid(), v_role.church_id) then
    raise exception 'You do not have permission to manage roles for this church'
      using errcode = '42501';
  end if;

  delete from public.user_roles
  where id = v_role.id;

  return jsonb_build_object('success', true, 'id', v_role.id);
end;
$$;

grant execute on function public.can_manage_church_roles(uuid, uuid) to authenticated;
grant execute on function public.get_church_role_assignments(uuid) to authenticated;
grant execute on function public.assign_church_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_church_member_role(uuid) to authenticated;
