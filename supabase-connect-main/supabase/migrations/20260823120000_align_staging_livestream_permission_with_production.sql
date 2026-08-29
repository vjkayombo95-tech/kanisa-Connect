-- Expose the production Livestream permission wrapper expected by the
-- production member hooks. Authorization remains delegated to staging's
-- authoritative, tenant-scoped generic permission engine.

create or replace function public.has_livestream_permission(
  _user_id uuid,
  _church_id uuid,
  _action text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.has_church_feature_permission(_user_id, _church_id, 'livestream', _action);
$$;

revoke all on function public.has_livestream_permission(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.has_livestream_permission(uuid,uuid,text)
  to authenticated;

comment on function public.has_livestream_permission(uuid,uuid,text) is
  'Production-compatible Livestream permission wrapper; delegates to tenant-scoped feature authorization.';
