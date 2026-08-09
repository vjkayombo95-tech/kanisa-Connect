-- RC-2.9.2: align paid event registration RPC with the real events schema.
-- public.events does not have a guaranteed status column in the migration
-- chain. Archived events are already excluded by archived_at.

create or replace function public.register_for_event(_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_member public.members%rowtype;
  v_existing public.event_attendances%rowtype;
  v_registered_count integer;
  v_is_paid boolean;
  v_registration_status text;
  v_payment_status text;
  v_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required.');
  end if;

  if _event_id is null then
    return jsonb_build_object('success', false, 'error', 'Event is required.');
  end if;

  select * into v_event
  from public.events
  where id = _event_id
    and archived_at is null
  for update;

  if v_event.id is null then
    return jsonb_build_object('success', false, 'error', 'Event was not found.');
  end if;

  if not public.can_view_event(auth.uid(), v_event.id) then
    return jsonb_build_object('success', false, 'error', 'You are not authorized to register for this event.');
  end if;

  if v_event.registration_deadline is not null and now() > v_event.registration_deadline then
    return jsonb_build_object('success', false, 'error', 'Registration deadline has passed.');
  end if;

  select * into v_member
  from public.members m
  where m.church_id = v_event.church_id
    and coalesce(m.status, 'active') = 'active'
    and (
      m.user_id = auth.uid()
      or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  order by case when m.user_id = auth.uid() then 0 else 1 end
  limit 1;

  if v_member.id is null then
    return jsonb_build_object('success', false, 'error', 'Member profile is required before registering.');
  end if;

  select * into v_existing
  from public.event_attendances
  where event_id = v_event.id
    and member_id = v_member.id
  for update;

  if v_existing.id is null and v_event.registration_capacity is not null then
    select count(*) into v_registered_count
    from public.event_attendances ea
    where ea.event_id = v_event.id
      and ea.registration_status in ('registered', 'payment_pending', 'payment_submitted', 'confirmed');

    if v_registered_count >= v_event.registration_capacity then
      return jsonb_build_object('success', false, 'error', 'Registration is full.');
    end if;
  end if;

  v_is_paid := coalesce(v_event.registration_type, 'free') = 'paid';

  if v_is_paid then
    v_registration_status := 'payment_pending';
    v_payment_status := 'pending';
    v_confirmed_at := null;
  else
    v_registration_status := 'confirmed';
    v_payment_status := 'not_required';
    v_confirmed_at := now();
  end if;

  insert into public.event_attendances (
    church_id,
    event_id,
    member_id,
    response,
    responded_at,
    registration_status,
    payment_status,
    amount_due,
    currency,
    registered_at,
    confirmed_at,
    cancelled_at
  )
  values (
    v_event.church_id,
    v_event.id,
    v_member.id,
    'yes',
    now(),
    v_registration_status,
    v_payment_status,
    case when v_is_paid then v_event.registration_fee else 0 end,
    coalesce(nullif(trim(v_event.registration_currency), ''), 'TZS'),
    now(),
    v_confirmed_at,
    null
  )
  on conflict (event_id, member_id) do update
    set response = 'yes',
        responded_at = now(),
        registration_status = case
          when event_attendances.registration_status in ('confirmed', 'payment_submitted', 'refunded')
            then event_attendances.registration_status
          when event_attendances.payment_status = 'paid'
            then 'confirmed'
          else excluded.registration_status
        end,
        payment_status = case
          when event_attendances.payment_status in ('paid', 'submitted', 'refunded')
            then event_attendances.payment_status
          else excluded.payment_status
        end,
        amount_due = excluded.amount_due,
        currency = excluded.currency,
        confirmed_at = case
          when event_attendances.payment_status = 'paid' then coalesce(event_attendances.confirmed_at, now())
          when excluded.payment_status = 'not_required' then coalesce(event_attendances.confirmed_at, excluded.confirmed_at)
          else event_attendances.confirmed_at
        end,
        cancelled_at = null
  returning * into v_existing;

  return jsonb_build_object(
    'success', true,
    'attendance_id', v_existing.id,
    'event_id', v_event.id,
    'member_id', v_member.id,
    'registration_status', v_existing.registration_status,
    'payment_status', v_existing.payment_status,
    'amount_due', v_existing.amount_due,
    'currency', v_existing.currency
  );
end;
$$;

grant execute on function public.register_for_event(uuid) to authenticated;
