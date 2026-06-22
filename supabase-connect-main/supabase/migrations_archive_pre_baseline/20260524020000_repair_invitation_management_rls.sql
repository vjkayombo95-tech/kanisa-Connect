-- Allow current workspace managers to issue and administer member invitations.
create or replace function public.can_manage_church_workspace(_user_id uuid, _church_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _user_id is null or _church_id is null
     or to_regclass('public.user_roles') is null
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'user_roles' and column_name in ('user_id', 'church_id', 'role')) <> 3 then
    return false;
  end if;
  return (
  _user_id is not null
    and _church_id is not null
    and (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.church_id = _church_id
          and lower(coalesce(ur.role::text, '')) in ('church_admin', 'admin', 'pastor', 'secretary', 'treasurer')
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = _user_id
          and p.church_id = _church_id
          and lower(coalesce(p.role, '')) in ('church_admin', 'admin', 'pastor', 'secretary', 'treasurer')
      )
      or exists (
        select 1
        from public.churches c
        where c.id = _church_id
          and (_user_id = c.owner_id or _user_id = c.created_by)
      )
      or exists (
        select 1
        from public.super_admins sa
        where sa.id = _user_id
      )
    ));
end;
$$;

grant execute on function public.can_manage_church_workspace(uuid, uuid) to authenticated;

create or replace function public.accept_invitation(_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _invitation public.invitations%rowtype;
  _member_id uuid;
  _linked_user_id uuid;
  _user_id uuid := auth.uid();
  _user_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  _member_name text;
  _role text;
begin
  if _user_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select i.* into _invitation
  from public.invitations i
  where i.token = _token
  limit 1;

  if _invitation.id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid invitation token');
  end if;

  if coalesce(_invitation.status, 'pending') = 'accepted' then
    return jsonb_build_object('success', false, 'error', 'This invitation has already been accepted');
  end if;

  if _invitation.status = 'revoked' then
    return jsonb_build_object('success', false, 'error', 'This invitation has been revoked');
  end if;

  if _invitation.expires_at is not null and _invitation.expires_at < now() then
    update public.invitations set status = 'expired' where id = _invitation.id;
    return jsonb_build_object('success', false, 'error', 'This invitation has expired');
  end if;

  if _user_email is null
    or _invitation.email is null
    or _user_email <> lower(trim(_invitation.email)) then
    return jsonb_build_object(
      'success', false,
      'error', format('Please sign in as %s to accept this invitation', coalesce(_invitation.email, 'the invited email'))
    );
  end if;

  select m.id, m.user_id into _member_id, _linked_user_id
  from public.members m
  where m.church_id = _invitation.church_id
    and lower(trim(coalesce(m.email, ''))) = _user_email
  order by m.created_at
  limit 1;

  if _member_id is not null and _linked_user_id is not null and _linked_user_id <> _user_id then
    return jsonb_build_object('success', false, 'error', 'This invitation has already been linked to another account');
  end if;

  if _member_id is null then
    _member_name := coalesce(
      nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
      split_part(_user_email, '@', 1),
      'Member'
    );

    insert into public.members (full_name, email, church_id, user_id, status)
    values (_member_name, _user_email, _invitation.church_id, _user_id, 'active')
    returning id into _member_id;
  else
    update public.members
    set user_id = _user_id,
        status = 'active'
    where id = _member_id;
  end if;

  _role := coalesce(nullif(trim(_invitation.role), ''), 'member');

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.church_id = _invitation.church_id
  ) then
    update public.user_roles
    set role = _role
    where user_id = _user_id
      and church_id = _invitation.church_id;
  else
    insert into public.user_roles (user_id, church_id, role)
    values (_user_id, _invitation.church_id, _role);
  end if;

  update public.invitations
  set status = 'accepted'
  where id = _invitation.id;

  return jsonb_build_object(
    'success', true,
    'church_id', _invitation.church_id,
    'church_name', (select c.name from public.churches c where c.id = _invitation.church_id),
    'member_id', _member_id,
    'role', _role
  );
end;
$$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

create or replace function public.get_public_invitation(_token text)
returns table (
  id uuid,
  email text,
  token text,
  church_id uuid,
  status text,
  expires_at timestamp without time zone,
  invited_by uuid,
  created_at timestamp without time zone,
  role text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    i.id,
    i.email,
    i.token,
    i.church_id,
    i.status,
    i.expires_at,
    i.invited_by,
    i.created_at,
    i.role
  from public.invitations i
  where i.token = _token
  limit 1;
$$;

revoke all on function public.get_public_invitation(text) from public;
grant execute on function public.get_public_invitation(text) to anon, authenticated;

alter table public.invitations enable row level security;
drop policy if exists "Workspace managers can manage invitations" on public.invitations;
create policy "Workspace managers can manage invitations"
on public.invitations
for all
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));
