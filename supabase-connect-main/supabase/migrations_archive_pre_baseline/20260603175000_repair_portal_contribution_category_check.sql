create or replace function public.record_portal_contribution(
  _church_id uuid,
  _amount numeric,
  _member_id uuid default null,
  _donor_name text default null,
  _phone text default null,
  _payment_reference text default null,
  _category_id uuid default null,
  _notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _contribution_id uuid;
  _categories_have_church_id boolean;
  _category_valid boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _church_id is null then
    return jsonb_build_object('success', false, 'error', 'Church is required');
  end if;

  if _amount is null or _amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = _church_id
  ) and not exists (
    select 1
    from public.members m
    where m.user_id = auth.uid()
      and m.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'You are not allowed to record contributions for this church');
  end if;

  if _member_id is not null and not exists (
    select 1
    from public.members m
    where m.id = _member_id
      and m.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Member does not belong to this church');
  end if;

  if _category_id is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contribution_categories'
        and column_name = 'church_id'
    )
    into _categories_have_church_id;

    if _categories_have_church_id then
      execute
        'select exists (
          select 1
          from public.contribution_categories c
          where c.id = $1
            and c.church_id = $2
        )'
      into _category_valid
      using _category_id, _church_id;
    else
      select exists (
        select 1
        from public.contribution_categories c
        where c.id = _category_id
      )
      into _category_valid;
    end if;

    if not _category_valid then
      return jsonb_build_object('success', false, 'error', 'Contribution category was not found');
    end if;
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
    notes
  )
  values (
    _church_id,
    _amount,
    nullif(trim(coalesce(_donor_name, '')), ''),
    _member_id,
    nullif(trim(coalesce(_phone, '')), ''),
    nullif(trim(coalesce(_payment_reference, '')), ''),
    _category_id,
    auth.uid(),
    nullif(trim(coalesce(_notes, '')), '')
  )
  returning id into _contribution_id;

  return jsonb_build_object('success', true, 'id', _contribution_id);
end;
$$;

grant execute on function public.record_portal_contribution(uuid, numeric, uuid, text, text, text, uuid, text) to authenticated;
