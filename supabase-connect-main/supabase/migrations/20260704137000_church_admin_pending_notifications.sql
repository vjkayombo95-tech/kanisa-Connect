-- Global church admin pending approval counters.
-- Uses guarded dynamic SQL so optional workflow tables can be introduced in
-- different environments without breaking this aggregate RPC.

create or replace function public.get_church_admin_pending_counts(_church_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_events integer := 0;
  v_sacraments integer := 0;
  v_mass_intentions integer := 0;
  v_payments integer := 0;
  v_memberships integer := 0;
  v_volunteers integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if _church_id is null then
    raise exception 'Church is required'
      using errcode = '22023';
  end if;

  if not (
    public.can_manage_church_roles(auth.uid(), _church_id)
    or public.can_manage_church_workspace(auth.uid(), _church_id)
    or public.is_platform_super_admin(auth.uid())
    or public.is_super_admin(auth.uid())
  ) then
    raise exception 'You do not have permission to view pending approvals for this church'
      using errcode = '42501';
  end if;

  if to_regclass('public.event_requests') is not null then
    execute $sql$
      select count(*)::integer
      from public.event_requests
      where church_id = $1
        and coalesce(status, 'submitted') in ('submitted', 'under_review')
    $sql$ into v_events using _church_id;
  end if;

  if to_regclass('public.sacramental_records') is not null then
    execute $sql$
      select count(*)::integer
      from public.sacramental_records
      where church_id = $1
        and coalesce(status, 'planned') in ('planned', 'preparation')
    $sql$ into v_sacraments using _church_id;
  end if;

  if to_regclass('public.mass_intentions') is not null then
    execute $sql$
      select count(*)::integer
      from public.mass_intentions
      where church_id = $1
        and (
          coalesce(status, 'pending') = 'pending'
          or coalesce(payment_status, 'pending') in ('pending', 'unpaid', 'submitted')
        )
    $sql$ into v_mass_intentions using _church_id;
  end if;

  if to_regclass('public.event_registration_payments') is not null then
    execute $sql$
      select count(*)::integer
      from public.event_registration_payments
      where church_id = $1
        and coalesce(status, 'pending') = 'pending'
    $sql$ into v_payments using _church_id;
  end if;

  if to_regclass('public.pledge_payments') is not null
    and to_regclass('public.pledges') is not null
  then
    execute $sql$
      select $2 + count(*)::integer
      from public.pledge_payments pp
      join public.pledges p on p.id = pp.pledge_id
      where p.church_id = $1
        and coalesce(pp.verification_status, 'pending') = 'pending'
    $sql$ into v_payments using _church_id, v_payments;
  end if;

  if to_regclass('public.community_join_requests') is not null then
    execute $sql$
      select count(*)::integer
      from public.community_join_requests
      where church_id = $1
        and coalesce(status, 'pending') in ('pending', 'submitted')
    $sql$ into v_memberships using _church_id;
  elsif to_regclass('public.community_membership_requests') is not null then
    execute $sql$
      select count(*)::integer
      from public.community_membership_requests
      where church_id = $1
        and coalesce(status, 'pending') in ('pending', 'submitted')
    $sql$ into v_memberships using _church_id;
  end if;

  if to_regclass('public.ministry_join_requests') is not null then
    execute $sql$
      select count(*)::integer
      from public.ministry_join_requests
      where church_id = $1
        and coalesce(status, 'pending') = 'pending'
    $sql$ into v_volunteers using _church_id;
  elsif to_regclass('public.volunteer_requests') is not null then
    execute $sql$
      select count(*)::integer
      from public.volunteer_requests
      where church_id = $1
        and coalesce(status, 'pending') in ('pending', 'submitted')
    $sql$ into v_volunteers using _church_id;
  end if;

  return jsonb_build_object(
    'events', coalesce(v_events, 0),
    'sacraments', coalesce(v_sacraments, 0),
    'massIntentions', coalesce(v_mass_intentions, 0),
    'payments', coalesce(v_payments, 0),
    'memberships', coalesce(v_memberships, 0),
    'volunteers', coalesce(v_volunteers, 0),
    'total',
      coalesce(v_events, 0)
      + coalesce(v_sacraments, 0)
      + coalesce(v_mass_intentions, 0)
      + coalesce(v_payments, 0)
      + coalesce(v_memberships, 0)
      + coalesce(v_volunteers, 0)
  );
end;
$$;

grant execute on function public.get_church_admin_pending_counts(uuid) to authenticated;
