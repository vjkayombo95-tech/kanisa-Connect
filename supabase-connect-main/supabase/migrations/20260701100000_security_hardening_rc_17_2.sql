-- RC-17.2 Security Hardening Implementation
-- Tighten member contribution attribution, move Community Help donation writes into
-- a transactional RPC, restrict direct platform fee inserts, and fix storage paths.

create or replace function public.record_contribution_with_key(
  p_church_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_member_id uuid default null,
  p_donor_name text default null,
  p_phone text default null,
  p_payment_reference text default null,
  p_category_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_contribution_id uuid;
  v_existing_id uuid;
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_categories_have_church_id boolean := false;
  v_category_valid boolean := false;
  v_is_privileged boolean := false;
begin
  if v_actor_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if p_church_id is null then
    return jsonb_build_object('success', false, 'error', 'Church is required');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  end if;

  if v_key is null then
    return jsonb_build_object('success', false, 'error', 'Idempotency key is required');
  end if;

  v_is_privileged :=
    public.is_super_admin(v_actor_id)
    or public.can_manage_church_workspace(v_actor_id, p_church_id);

  if not v_is_privileged and not exists (
    select 1
    from public.members m
    where m.user_id = v_actor_id
      and m.church_id = p_church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'You are not allowed to record contributions for this church');
  end if;

  if p_member_id is not null then
    if not exists (
      select 1
      from public.members m
      where m.id = p_member_id
        and m.church_id = p_church_id
    ) then
      return jsonb_build_object('success', false, 'error', 'Member does not belong to this church');
    end if;

    if not v_is_privileged and not exists (
      select 1
      from public.members m
      where m.id = p_member_id
        and m.church_id = p_church_id
        and m.user_id = v_actor_id
    ) then
      return jsonb_build_object('success', false, 'error', 'You are not allowed to record contributions for another member');
    end if;
  end if;

  if p_category_id is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contribution_categories'
        and column_name = 'church_id'
    )
    into v_categories_have_church_id;

    if v_categories_have_church_id then
      execute
        'select exists (
          select 1
          from public.contribution_categories c
          where c.id = $1
            and c.church_id = $2
        )'
      into v_category_valid
      using p_category_id, p_church_id;
    else
      select exists (
        select 1
        from public.contribution_categories c
        where c.id = p_category_id
      )
      into v_category_valid;
    end if;

    if not v_category_valid then
      return jsonb_build_object('success', false, 'error', 'Contribution category was not found');
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('record_contribution_with_key:' || p_church_id::text || ':' || v_actor_id::text || ':' || v_key, 0)
  );

  select c.id
  into v_existing_id
  from public.contributions c
  where c.church_id = p_church_id
    and c.created_by = v_actor_id
    and c.idempotency_key = v_key
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object(
      'success', true,
      'id', v_existing_id,
      'created', false
    );
  end if;

  insert into public.contributions (
    church_id,
    amount,
    donor_name,
    member_id,
    phone,
    payment_reference,
    category_id,
    created_by,
    notes,
    idempotency_key
  )
  values (
    p_church_id,
    p_amount,
    nullif(trim(coalesce(p_donor_name, '')), ''),
    p_member_id,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_payment_reference, '')), ''),
    p_category_id,
    v_actor_id,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_key
  )
  returning id into v_contribution_id;

  return jsonb_build_object(
    'success', true,
    'id', v_contribution_id,
    'created', true
  );
end;
$$;

create or replace function public.submit_community_help_donation(
  p_help_request_id uuid,
  p_member_id uuid,
  p_net_amount numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_request public.community_help_requests%rowtype;
  v_member public.members%rowtype;
  v_existing_contribution_id uuid;
  v_donation_id uuid;
  v_contribution_id uuid;
  v_net_amount numeric := round(coalesce(p_net_amount, 0), 2);
  v_fee_percentage numeric := 1;
  v_gross_amount numeric;
  v_fee_amount numeric;
  v_note text;
begin
  if v_actor_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if p_help_request_id is null or p_member_id is null then
    return jsonb_build_object('success', false, 'error', 'Help request and member are required');
  end if;

  if v_net_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  end if;

  if v_key is null then
    return jsonb_build_object('success', false, 'error', 'Idempotency key is required');
  end if;

  select *
  into v_request
  from public.community_help_requests
  where id = p_help_request_id
  for update;

  if v_request.id is null then
    return jsonb_build_object('success', false, 'error', 'Help request was not found');
  end if;

  if v_request.status <> 'approved' then
    return jsonb_build_object('success', false, 'error', 'This help request is not open for donations');
  end if;

  select *
  into v_member
  from public.members
  where id = p_member_id
    and church_id = v_request.church_id
    and user_id = v_actor_id
  limit 1;

  if v_member.id is null then
    return jsonb_build_object('success', false, 'error', 'You can only donate from your own member record');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('submit_community_help_donation:' || v_request.church_id::text || ':' || v_actor_id::text || ':' || v_key, 0)
  );

  select c.id
  into v_existing_contribution_id
  from public.contributions c
  where c.church_id = v_request.church_id
    and c.created_by = v_actor_id
    and c.idempotency_key = v_key
  limit 1;

  if v_existing_contribution_id is not null then
    return jsonb_build_object(
      'success', true,
      'created', false,
      'contribution_id', v_existing_contribution_id
    );
  end if;

  v_gross_amount := round(v_net_amount / (1 - (v_fee_percentage / 100)), 2);
  v_fee_amount := round(v_gross_amount - v_net_amount, 2);
  v_note := 'Community Help Donation - '
    || coalesce(v_request.category, 'General')
    || ': '
    || left(coalesce(v_request.description, ''), 60)
    || ' ('
    || v_fee_amount::text
    || ' platform fee)';

  insert into public.help_donations (
    help_request_id,
    amount,
    donor_name,
    is_anonymous
  )
  values (
    v_request.id,
    v_gross_amount,
    coalesce(nullif(trim(v_member.full_name), ''), 'Member'),
    false
  )
  returning id into v_donation_id;

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
    v_request.church_id,
    'community_help',
    v_request.id,
    v_gross_amount,
    v_fee_percentage,
    v_fee_amount,
    v_net_amount,
    v_member.id
  );

  update public.community_help_requests
  set current_amount = coalesce(current_amount, 0) + v_net_amount
  where id = v_request.id;

  insert into public.contributions (
    church_id,
    amount,
    donor_name,
    member_id,
    created_by,
    notes,
    idempotency_key
  )
  values (
    v_request.church_id,
    v_net_amount,
    coalesce(nullif(trim(v_member.full_name), ''), 'Member'),
    v_member.id,
    v_actor_id,
    v_note,
    v_key
  )
  returning id into v_contribution_id;

  return jsonb_build_object(
    'success', true,
    'created', true,
    'donation_id', v_donation_id,
    'contribution_id', v_contribution_id,
    'gross_amount', v_gross_amount,
    'fee_amount', v_fee_amount,
    'net_amount', v_net_amount
  );
end;
$$;

grant execute on function public.submit_community_help_donation(uuid, uuid, numeric, text) to authenticated;

drop policy if exists "Create platform fees" on public.platform_fees;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    drop policy if exists "Workspace managers can read billing receipts" on storage.objects;
    drop policy if exists "Workspace managers can upload billing receipts" on storage.objects;

    create policy "Workspace managers can read billing receipts"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'billing-receipts'
      and exists (
        select 1
        from public.churches c
        where c.id::text = (storage.foldername(objects.name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    );

    create policy "Workspace managers can upload billing receipts"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'billing-receipts'
      and exists (
        select 1
        from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    );

    drop policy if exists "Members can upload own profile photo" on storage.objects;
    drop policy if exists "Members can update own profile photo" on storage.objects;

    create policy "Members can upload own profile photo"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'church-assets'
      and (storage.foldername(name))[2] = 'members'
      and exists (
        select 1
        from public.members m
        where m.church_id::text = (storage.foldername(name))[1]
          and m.id::text = split_part(storage.filename(name), '.', 1)
          and m.user_id = auth.uid()
      )
    );

    create policy "Members can update own profile photo"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'church-assets'
      and (storage.foldername(name))[2] = 'members'
      and exists (
        select 1
        from public.members m
        where m.church_id::text = (storage.foldername(name))[1]
          and m.id::text = split_part(storage.filename(name), '.', 1)
          and m.user_id = auth.uid()
      )
    )
    with check (
      bucket_id = 'church-assets'
      and (storage.foldername(name))[2] = 'members'
      and exists (
        select 1
        from public.members m
        where m.church_id::text = (storage.foldername(name))[1]
          and m.id::text = split_part(storage.filename(name), '.', 1)
          and m.user_id = auth.uid()
      )
    );
  end if;
end $$;
