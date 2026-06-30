-- RC-1.3.3 Transactional Portal Submission Reliability
-- Moves portal prayer request and mass intention financial side effects into
-- single SECURITY DEFINER transactions with client idempotency keys.

alter table public.prayer_requests
add column if not exists idempotency_key text;

alter table public.mass_intentions
add column if not exists idempotency_key text;

create unique index if not exists prayer_requests_idempotency_key_idx
on public.prayer_requests (church_id, member_id, idempotency_key)
where idempotency_key is not null;

create unique index if not exists mass_intentions_idempotency_key_idx
on public.mass_intentions (church_id, member_id, idempotency_key)
where idempotency_key is not null;

create or replace function public.submit_portal_prayer_request(
  p_church_id uuid,
  p_member_id uuid,
  p_request_text text,
  p_offering_amount numeric default null,
  p_privacy text default 'public_to_church',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request_id uuid;
  v_existing_id uuid;
  v_member_name text;
  v_request_text text := trim(coalesce(p_request_text, ''));
  v_privacy text := coalesce(nullif(trim(p_privacy), ''), 'public_to_church');
  v_net_amount numeric := coalesce(p_offering_amount, 0);
  v_gross_amount numeric := 0;
  v_fee_amount numeric := 0;
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_church_id is null or p_member_id is null then
    raise exception 'Church and member context are required'
      using errcode = '22023';
  end if;

  if v_key is null then
    raise exception 'Idempotency key is required'
      using errcode = '22023';
  end if;

  if v_request_text = '' then
    raise exception 'Prayer request text is required'
      using errcode = '22023';
  end if;

  if v_net_amount < 0 then
    raise exception 'Offering amount cannot be negative'
      using errcode = '22023';
  end if;

  if v_privacy not in ('public_to_church', 'private_to_pastor_admin', 'anonymous_public') then
    raise exception 'Invalid prayer request privacy'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('portal_prayer_request:' || p_church_id::text || ':' || p_member_id::text || ':' || v_key, 0)
  );

  select pr.id
  into v_existing_id
  from public.prayer_requests pr
  where pr.church_id = p_church_id
    and pr.member_id = p_member_id
    and pr.idempotency_key = v_key
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object(
      'success', true,
      'id', v_existing_id,
      'created', false
    );
  end if;

  select m.full_name
  into v_member_name
  from public.members m
  where m.id = p_member_id
    and m.church_id = p_church_id
    and m.user_id = v_actor_id;

  if v_member_name is null then
    raise exception 'Member does not belong to the authenticated user and church'
      using errcode = '42501';
  end if;

  insert into public.prayer_requests (
    request_text,
    request,
    member_id,
    church_id,
    offering_amount,
    status,
    privacy,
    idempotency_key
  )
  values (
    v_request_text,
    v_request_text,
    p_member_id,
    p_church_id,
    nullif(v_net_amount, 0),
    'pending',
    v_privacy,
    v_key
  )
  returning id into v_request_id;

  if v_net_amount > 0 then
    v_gross_amount := round(v_net_amount / 0.99, 2);
    v_fee_amount := round(v_gross_amount - v_net_amount, 2);

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
      p_church_id,
      'prayer_request',
      v_request_id,
      v_gross_amount,
      1,
      v_fee_amount,
      v_net_amount,
      p_member_id
    );

    insert into public.contributions (
      church_id,
      amount,
      donor_name,
      member_id,
      notes
    )
    values (
      p_church_id,
      v_net_amount,
      v_member_name,
      p_member_id,
      'Prayer Request Offering - ' || left(v_request_text, 80) || ' (TZS ' || to_char(v_fee_amount, 'FM999999999990.00') || ' platform fee)'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'id', v_request_id,
    'created', true
  );
end;
$$;

create or replace function public.submit_portal_mass_intention(
  p_church_id uuid,
  p_member_id uuid,
  p_intention_type text,
  p_message text,
  p_offering_amount numeric,
  p_requested_mass_date date default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_intention_id uuid;
  v_existing_id uuid;
  v_member_name text;
  v_intention_type text := coalesce(nullif(trim(p_intention_type), ''), 'other');
  v_message text := trim(coalesce(p_message, ''));
  v_saved_message text;
  v_net_amount numeric := coalesce(p_offering_amount, 0);
  v_gross_amount numeric;
  v_fee_amount numeric;
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_church_id is null or p_member_id is null then
    raise exception 'Church and member context are required'
      using errcode = '22023';
  end if;

  if v_key is null then
    raise exception 'Idempotency key is required'
      using errcode = '22023';
  end if;

  if v_message = '' then
    raise exception 'Message is required'
      using errcode = '22023';
  end if;

  if p_requested_mass_date is null then
    raise exception 'Please select the Mass date'
      using errcode = '22023';
  end if;

  if v_net_amount < 1000 then
    raise exception 'Minimum offering is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('portal_mass_intention:' || p_church_id::text || ':' || p_member_id::text || ':' || v_key, 0)
  );

  select mi.id
  into v_existing_id
  from public.mass_intentions mi
  where mi.church_id = p_church_id
    and mi.member_id = p_member_id
    and mi.idempotency_key = v_key
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object(
      'success', true,
      'id', v_existing_id,
      'created', false
    );
  end if;

  select m.full_name
  into v_member_name
  from public.members m
  where m.id = p_member_id
    and m.church_id = p_church_id
    and m.user_id = v_actor_id;

  if v_member_name is null then
    raise exception 'Member does not belong to the authenticated user and church'
      using errcode = '42501';
  end if;

  v_gross_amount := round(v_net_amount / 0.99, 2);
  v_fee_amount := round(v_gross_amount - v_net_amount, 2);
  v_saved_message := 'Tarehe ya Misa: ' || p_requested_mass_date::text || E'\n\n' || v_message;

  insert into public.mass_intentions (
    intention_type,
    intention,
    message,
    offering_amount,
    amount,
    member_id,
    church_id,
    mass_date,
    requested_by_name,
    offered_for_name,
    status,
    idempotency_key
  )
  values (
    v_intention_type,
    v_message,
    v_saved_message,
    v_net_amount,
    v_net_amount,
    p_member_id,
    p_church_id,
    p_requested_mass_date,
    v_member_name,
    v_member_name,
    'pending',
    v_key
  )
  returning id into v_intention_id;

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
    p_church_id,
    'mass_intention',
    v_intention_id,
    v_gross_amount,
    1,
    v_fee_amount,
    v_net_amount,
    p_member_id
  );

  insert into public.contributions (
    church_id,
    amount,
    donor_name,
    member_id,
    notes
  )
  values (
    p_church_id,
    v_net_amount,
    v_member_name,
    p_member_id,
    'Nia ya Misa: ' || v_intention_type || ' - ' || p_requested_mass_date::text || ' - ' || left(v_message, 80) || ' (TZS ' || to_char(v_fee_amount, 'FM999999999990.00') || ' platform fee)'
  );

  return jsonb_build_object(
    'success', true,
    'id', v_intention_id,
    'created', true
  );
end;
$$;

grant execute on function public.submit_portal_prayer_request(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text
) to authenticated;

grant execute on function public.submit_portal_mass_intention(
  uuid,
  uuid,
  text,
  text,
  numeric,
  date,
  text
) to authenticated;
