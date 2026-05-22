create or replace function public.make_pledge_payment(
  _pledge_id uuid,
  _amount numeric,
  _payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _pledge public.pledges%rowtype;
  _new_amount_paid numeric(12,2);
  _new_status text;
  _payment_id uuid;
  _fee_percentage numeric(5,2) := 1.0;
  _fee_amount numeric(12,2);
  _net_amount numeric(12,2);
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _pledge_id is null or _amount is null or _amount <= 0 or coalesce(btrim(_payment_method), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Invalid payment details');
  end if;

  select *
  into _pledge
  from public.pledges
  where id = _pledge_id
  for update;

  if _pledge.id is null then
    return jsonb_build_object('success', false, 'error', 'Pledge not found');
  end if;

  if not (
    public.is_pledge_owner(_pledge.member_id)
    or public.is_pledge_admin_for_church(_pledge.church_id)
    or (_pledge.community_id is not null and public.is_pledge_leader_for_community(_pledge.community_id))
  ) then
    return jsonb_build_object('success', false, 'error', 'Not allowed to make payment on this pledge');
  end if;

  _fee_amount := round((_amount * _fee_percentage) / 100.0, 2);
  _net_amount := round(_amount - _fee_amount, 2);

  if _net_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Payment amount is too small after the platform fee');
  end if;

  if _pledge.amount_paid + _net_amount > _pledge.amount_pledged then
    return jsonb_build_object('success', false, 'error', 'Net payment exceeds the remaining pledge balance');
  end if;

  insert into public.pledge_payments (pledge_id, member_id, amount, payment_method)
  values (_pledge.id, _pledge.member_id, _amount, _payment_method)
  returning id into _payment_id;

  insert into public.platform_fees (
    church_id,
    source_type,
    source_id,
    gross_amount,
    fee_percentage,
    fee_amount,
    net_amount,
    member_id
  )
  values (
    _pledge.church_id,
    'pledge_payment',
    _payment_id,
    _amount,
    _fee_percentage,
    _fee_amount,
    _net_amount,
    _pledge.member_id
  );

  _new_amount_paid := _pledge.amount_paid + _net_amount;
  _new_status := case
    when _new_amount_paid <= 0 then 'pending'
    when _new_amount_paid < _pledge.amount_pledged then 'partial'
    else 'completed'
  end;

  update public.pledges
  set
    amount_paid = _new_amount_paid,
    status = _new_status
  where id = _pledge.id;

  if _pledge.community_id is not null then
    insert into public.community_targets (community_id, church_id, target_amount, total_pledged, total_paid)
    values (_pledge.community_id, _pledge.church_id, 0, 0, _net_amount)
    on conflict (community_id) do update
    set total_paid = public.community_targets.total_paid + excluded.total_paid;
  end if;

  return jsonb_build_object(
    'success', true,
    'payment_id', _payment_id,
    'pledge_id', _pledge.id,
    'gross_amount', _amount,
    'fee_amount', _fee_amount,
    'net_amount', _net_amount,
    'amount_paid', _new_amount_paid,
    'status', _new_status
  );
end;
$$;

with payment_totals as (
  select
    pp.pledge_id,
    round(
      sum(
        coalesce(
          case
            when pf.source_type = 'pledge_payment' then pf.net_amount
            else null
          end,
          round(pp.amount / 1.01, 2)
        )
      ),
      2
    ) as net_paid
  from public.pledge_payments pp
  left join public.platform_fees pf
    on pf.source_id = pp.id
   and pf.source_type = 'pledge_payment'
  group by pp.pledge_id
)
update public.pledges p
set
  amount_paid = coalesce(pt.net_paid, 0),
  status = case
    when coalesce(pt.net_paid, 0) <= 0 then 'pending'
    when coalesce(pt.net_paid, 0) < p.amount_pledged then 'partial'
    else 'completed'
  end
from payment_totals pt
where p.id = pt.pledge_id;

update public.pledges
set
  amount_paid = 0,
  status = 'pending'
where id not in (
  select distinct pledge_id
  from public.pledge_payments
);

with community_paid as (
  select
    p.community_id,
    round(sum(p.amount_paid), 2) as total_paid
  from public.pledges p
  where p.community_id is not null
  group by p.community_id
)
update public.community_targets ct
set total_paid = coalesce(cp.total_paid, 0)
from community_paid cp
where ct.community_id = cp.community_id;

update public.community_targets
set total_paid = 0
where community_id not in (
  select distinct community_id
  from public.pledges
  where community_id is not null
    and amount_paid > 0
);
