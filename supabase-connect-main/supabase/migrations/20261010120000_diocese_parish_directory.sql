-- Slice 4: Diocese parish directory
--
-- Provides a deliberately narrow, read-only parish directory to users who
-- are authorized to view the requested Diocese.
--
-- Important authorization boundary:
-- Diocese visibility does not grant church/parish authority.

create or replace function public.get_diocese_parishes(
  _diocese_id uuid
)
returns table (
  diocese_church_id uuid,
  church_id uuid,
  church_name text,
  church_code text,
  church_address text,
  church_email text,
  church_phone text,
  church_logo_url text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    dc.id as diocese_church_id,
    c.id as church_id,
    c.name as church_name,
    c.code as church_code,
    c.address as church_address,
    c.email as church_email,
    c.phone as church_phone,
    c.logo_url as church_logo_url,
    dc.joined_at
  from public.diocese_churches dc
  join public.churches c
    on c.id = dc.church_id
  where _diocese_id is not null
    and dc.diocese_id = _diocese_id
    and dc.status = 'active'
    and public.current_user_can_view_diocese(_diocese_id)
  order by c.name asc, c.id asc;
$$;

comment on function public.get_diocese_parishes(uuid) is
  'Caller-authorized read-only Diocese parish directory. Diocese visibility does not grant church authority.';

alter function public.get_diocese_parishes(uuid) owner to postgres;

revoke all on function public.get_diocese_parishes(uuid)
  from public, anon, authenticated;

grant execute on function public.get_diocese_parishes(uuid)
  to authenticated, service_role;
