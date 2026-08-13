-- RC-2.9.3: Unified church financial reporting projection.
-- This does not move or duplicate money records. It aggregates verified source
-- rows for parish reporting while preserving each source's business meaning.

create or replace function public.get_church_financial_summary(
  _church_id uuid,
  _start_date date default null,
  _end_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz := case when _start_date is null then null else _start_date::timestamptz end;
  v_end timestamptz := case when _end_date is null then null else (_end_date + 1)::timestamptz end;
  v_month_start timestamptz := date_trunc('month', now());
  v_next_month timestamptz := date_trunc('month', now()) + interval '1 month';
  v_contribution_total numeric := 0;
  v_pledge_payment_total numeric := 0;
  v_event_registration_total numeric := 0;
  v_this_month_contributions numeric := 0;
  v_this_month_pledge_payments numeric := 0;
  v_this_month_event_registrations numeric := 0;
  v_contribution_count integer := 0;
  v_pledge_payment_count integer := 0;
  v_event_registration_count integer := 0;
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
    public.can_manage_church_workspace(auth.uid(), _church_id)
    or public.can_manage_church_roles(auth.uid(), _church_id)
    or public.is_platform_super_admin(auth.uid())
    or public.is_super_admin(auth.uid())
  ) then
    raise exception 'You do not have permission to view financial summaries for this church'
      using errcode = '42501';
  end if;

  if to_regclass('public.contributions') is not null then
    execute $sql$
      select coalesce(sum(amount), 0), count(*)::integer
      from public.contributions
      where church_id = $1
        and ($2 is null or coalesce(date::timestamptz, created_at) >= $2)
        and ($3 is null or coalesce(date::timestamptz, created_at) < $3)
    $sql$ into v_contribution_total, v_contribution_count using _church_id, v_start, v_end;

    execute $sql$
      select coalesce(sum(amount), 0)
      from public.contributions
      where church_id = $1
        and coalesce(date::timestamptz, created_at) >= $2
        and coalesce(date::timestamptz, created_at) < $3
    $sql$ into v_this_month_contributions using _church_id, v_month_start, v_next_month;
  end if;

  if to_regclass('public.pledge_payments') is not null
    and to_regclass('public.pledges') is not null
  then
    execute $sql$
      select coalesce(sum(pp.amount), 0), count(*)::integer
      from public.pledge_payments pp
      join public.pledges p on p.id = pp.pledge_id
      where p.church_id = $1
        and coalesce(pp.verification_status, 'pending') = 'approved'
        and ($2 is null or pp.created_at >= $2)
        and ($3 is null or pp.created_at < $3)
    $sql$ into v_pledge_payment_total, v_pledge_payment_count using _church_id, v_start, v_end;

    execute $sql$
      select coalesce(sum(pp.amount), 0)
      from public.pledge_payments pp
      join public.pledges p on p.id = pp.pledge_id
      where p.church_id = $1
        and coalesce(pp.verification_status, 'pending') = 'approved'
        and pp.created_at >= $2
        and pp.created_at < $3
    $sql$ into v_this_month_pledge_payments using _church_id, v_month_start, v_next_month;
  end if;

  if to_regclass('public.event_registration_payments') is not null then
    execute $sql$
      select coalesce(sum(amount), 0), count(*)::integer
      from public.event_registration_payments
      where church_id = $1
        and coalesce(status, 'pending') = 'approved'
        and ($2 is null or coalesce(reviewed_at, updated_at, created_at) >= $2)
        and ($3 is null or coalesce(reviewed_at, updated_at, created_at) < $3)
    $sql$ into v_event_registration_total, v_event_registration_count using _church_id, v_start, v_end;

    execute $sql$
      select coalesce(sum(amount), 0)
      from public.event_registration_payments
      where church_id = $1
        and coalesce(status, 'pending') = 'approved'
        and coalesce(reviewed_at, updated_at, created_at) >= $2
        and coalesce(reviewed_at, updated_at, created_at) < $3
    $sql$ into v_this_month_event_registrations using _church_id, v_month_start, v_next_month;
  end if;

  return jsonb_build_object(
    'total_received',
      coalesce(v_contribution_total, 0)
      + coalesce(v_pledge_payment_total, 0)
      + coalesce(v_event_registration_total, 0),
    'this_month_received',
      coalesce(v_this_month_contributions, 0)
      + coalesce(v_this_month_pledge_payments, 0)
      + coalesce(v_this_month_event_registrations, 0),
    'transaction_count',
      coalesce(v_contribution_count, 0)
      + coalesce(v_pledge_payment_count, 0)
      + coalesce(v_event_registration_count, 0),
    'contribution_total', coalesce(v_contribution_total, 0),
    'pledge_payment_total', coalesce(v_pledge_payment_total, 0),
    'event_registration_total', coalesce(v_event_registration_total, 0),
    'this_month_contribution_total', coalesce(v_this_month_contributions, 0),
    'this_month_pledge_payment_total', coalesce(v_this_month_pledge_payments, 0),
    'this_month_event_registration_total', coalesce(v_this_month_event_registrations, 0),
    'contribution_count', coalesce(v_contribution_count, 0),
    'pledge_payment_count', coalesce(v_pledge_payment_count, 0),
    'event_registration_count', coalesce(v_event_registration_count, 0)
  );
end;
$$;

grant execute on function public.get_church_financial_summary(uuid, date, date) to authenticated;
