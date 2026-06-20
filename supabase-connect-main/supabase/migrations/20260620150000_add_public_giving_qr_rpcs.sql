create or replace function public.get_public_giving_church(p_slug_or_id text)
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  tagline text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lookup text := nullif(trim(coalesce(p_slug_or_id, '')), '');
  v_lookup_uuid uuid;
begin
  if v_lookup is null then
    return;
  end if;

  if v_lookup ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_lookup_uuid := v_lookup::uuid;
  end if;

  return query
  select
    c.id,
    c.name,
    c.slug,
    c.logo_url,
    coalesce(c.metadata ->> 'tagline', 'Secure digital giving for your church community.') as tagline
  from public.churches c
  where lower(c.slug) = lower(v_lookup)
     or (v_lookup_uuid is not null and c.id = v_lookup_uuid)
  order by case when lower(c.slug) = lower(v_lookup) then 0 else 1 end
  limit 1;
end;
$$;

revoke all on function public.get_public_giving_church(text) from public;
grant execute on function public.get_public_giving_church(text) to anon, authenticated;

create or replace function public.submit_public_contribution(
  p_church_slug_or_id text,
  p_contribution_type text,
  p_amount numeric,
  p_donor_name text,
  p_phone text,
  p_note text default null,
  p_transaction_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
  v_category_id uuid;
  v_type text := nullif(trim(coalesce(p_contribution_type, '')), '');
  v_donor_name text := nullif(trim(coalesce(p_donor_name, '')), '');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_transaction_id text := nullif(trim(coalesce(p_transaction_id, '')), '');
  v_contribution_id uuid;
begin
  select church.id
  into v_church_id
  from public.get_public_giving_church(p_church_slug_or_id) as church
  limit 1;

  if v_church_id is null then
    return jsonb_build_object('success', false, 'error', 'Church not found.');
  end if;

  if v_type is null or v_type not in ('Sadaka', 'Zaka', 'Jengo', 'Shukrani', 'Special Contribution') then
    return jsonb_build_object('success', false, 'error', 'Choose a valid contribution type.');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  end if;

  if v_donor_name is null or length(v_donor_name) < 2 then
    return jsonb_build_object('success', false, 'error', 'Member name is required.');
  end if;

  if v_phone !~ '^\+?[0-9]{9,15}$' then
    return jsonb_build_object('success', false, 'error', 'Enter a valid phone number.');
  end if;

  if v_transaction_id is not null and v_transaction_id !~ '^[A-Za-z0-9._-]{4,80}$' then
    return jsonb_build_object('success', false, 'error', 'Enter a valid transaction ID.');
  end if;

  select cc.id
  into v_category_id
  from public.contribution_categories cc
  where cc.church_id = v_church_id
    and lower(cc.name) = lower(
      case v_type
        when 'Sadaka' then 'Offering'
        when 'Zaka' then 'Tithe'
        when 'Jengo' then 'Building Fund'
        when 'Shukrani' then 'Donations'
        else 'Donations'
      end
    )
  limit 1;

  insert into public.contributions (
    church_id,
    amount,
    category_id,
    donor_name,
    phone,
    payment_reference,
    notes,
    currency,
    date,
    created_by
  )
  values (
    v_church_id,
    p_amount,
    v_category_id,
    left(v_donor_name, 160),
    left(v_phone, 32),
    left(v_transaction_id, 120),
    left(concat_ws(
      E'\n',
      'Public QR giving submission - pending confirmation',
      'Type: ' || v_type,
      case when v_note is not null then 'Note: ' || v_note else null end
    ), 1000),
    'TZS',
    current_date,
    null
  )
  returning id into v_contribution_id;

  return jsonb_build_object(
    'success', true,
    'contribution_id', v_contribution_id,
    'message', 'Thank you. Your contribution has been submitted for confirmation.'
  );
end;
$$;

revoke all on function public.submit_public_contribution(text, text, numeric, text, text, text, text) from public;
grant execute on function public.submit_public_contribution(text, text, numeric, text, text, text, text) to anon, authenticated;
