-- RC-1.4.1 Financial Idempotency Hardening
-- Adds idempotent contribution recording for offline replay and portal giving.

alter table public.contributions
add column if not exists idempotency_key text;

create unique index if not exists contributions_created_by_idempotency_key_idx
on public.contributions (church_id, created_by, idempotency_key)
where idempotency_key is not null;

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

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor_id
      and ur.church_id = p_church_id
  ) and not exists (
    select 1
    from public.members m
    where m.user_id = v_actor_id
      and m.church_id = p_church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'You are not allowed to record contributions for this church');
  end if;

  if p_member_id is not null and not exists (
    select 1
    from public.members m
    where m.id = p_member_id
      and m.church_id = p_church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Member does not belong to this church');
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

grant execute on function public.record_contribution_with_key(
  uuid,
  numeric,
  text,
  uuid,
  text,
  text,
  text,
  uuid,
  text
) to authenticated;
