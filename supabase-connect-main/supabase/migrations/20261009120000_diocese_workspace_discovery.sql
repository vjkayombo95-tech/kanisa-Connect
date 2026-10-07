-- Diocese workspace discovery.
--
-- Caller-bound API for discovering Diocese workspaces available to the
-- currently authenticated user.
--
-- IMPORTANT:
-- Diocese authority remains completely separate from church authority.
-- This function does not inspect or modify church_memberships, user_roles,
-- members, or any existing church authorization helper.

create or replace function public.get_my_diocese_workspaces()
returns table (
  diocese_id uuid,
  diocese_name text,
  diocese_slug text,
  diocese_logo_url text,
  diocese_cover_photo_url text,
  staff_role text,
  staff_membership_id uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    d.id as diocese_id,
    d.name as diocese_name,
    d.slug as diocese_slug,
    d.logo_url as diocese_logo_url,
    d.cover_photo_url as diocese_cover_photo_url,
    ds.role as staff_role,
    ds.id as staff_membership_id
  from public.diocese_staff ds
  join public.dioceses d
    on d.id = ds.diocese_id
  where auth.uid() is not null
    and ds.user_id = auth.uid()
    and ds.status = 'active'
    and d.status = 'active'
  order by d.name asc, d.id asc;
$$;

comment on function public.get_my_diocese_workspaces() is
  'Returns active Diocese workspaces for the authenticated caller only. Grants no church or parish authority.';

alter function public.get_my_diocese_workspaces() owner to postgres;

revoke all on function public.get_my_diocese_workspaces()
  from public, anon, authenticated;

grant execute on function public.get_my_diocese_workspaces()
  to authenticated, service_role;
