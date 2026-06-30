-- RC-1.3.6 Final Reliability Hardening
-- Locks invitation acceptance and makes contribution edit/delete audit writes transactional.

create or replace function public.accept_invitation(_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _invitation public.invitations%rowtype;
  _member_id uuid;
  _linked_user_id uuid;
  _user_id uuid := auth.uid();
  _user_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  _member_name text;
  _role text;
  _updated_count integer := 0;
begin
  if _user_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select i.* into _invitation
  from public.invitations i
  where i.token = _token
  limit 1
  for update;

  if _invitation.id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid invitation token');
  end if;

  if coalesce(_invitation.status, 'pending') = 'accepted' then
    return jsonb_build_object('success', false, 'error', 'This invitation has already been accepted');
  end if;

  if _invitation.status = 'revoked' then
    return jsonb_build_object('success', false, 'error', 'This invitation has been revoked');
  end if;

  if _invitation.status is distinct from 'pending' then
    return jsonb_build_object('success', false, 'error', 'This invitation is no longer pending');
  end if;

  if _invitation.expires_at is not null and _invitation.expires_at < now() then
    update public.invitations
    set status = 'expired'
    where id = _invitation.id
      and status = 'pending';

    return jsonb_build_object('success', false, 'error', 'This invitation has expired');
  end if;

  if _user_email is null
    or _invitation.email is null
    or _user_email <> lower(trim(_invitation.email)) then
    return jsonb_build_object(
      'success', false,
      'error', format('Please sign in as %s to accept this invitation', coalesce(_invitation.email, 'the invited email'))
    );
  end if;

  select m.id, m.user_id into _member_id, _linked_user_id
  from public.members m
  where m.church_id = _invitation.church_id
    and lower(trim(coalesce(m.email, ''))) = _user_email
  order by m.created_at
  limit 1;

  if _member_id is not null and _linked_user_id is not null and _linked_user_id <> _user_id then
    return jsonb_build_object('success', false, 'error', 'This invitation has already been linked to another account');
  end if;

  if _member_id is null then
    _member_name := coalesce(
      nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
      split_part(_user_email, '@', 1),
      'Member'
    );

    insert into public.members (full_name, email, church_id, user_id, status)
    values (_member_name, _user_email, _invitation.church_id, _user_id, 'active')
    returning id into _member_id;
  else
    update public.members
    set user_id = _user_id,
        status = 'active'
    where id = _member_id;
  end if;

  _role := coalesce(nullif(trim(_invitation.role), ''), 'member');

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.church_id = _invitation.church_id
  ) then
    update public.user_roles
    set role = _role
    where user_id = _user_id
      and church_id = _invitation.church_id;
  else
    insert into public.user_roles (user_id, church_id, role)
    values (_user_id, _invitation.church_id, _role);
  end if;

  update public.invitations
  set status = 'accepted'
  where id = _invitation.id
    and status = 'pending';

  get diagnostics _updated_count = row_count;

  if _updated_count <> 1 then
    raise exception 'Invitation status changed while it was being accepted'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'success', true,
    'church_id', _invitation.church_id,
    'church_name', (select c.name from public.churches c where c.id = _invitation.church_id),
    'member_id', _member_id,
    'role', _role
  );
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

create or replace function public.update_contribution_with_audit(
  p_contribution_id uuid,
  p_amount numeric,
  p_category_id uuid default null,
  p_donor_name text default null,
  p_member_id uuid default null,
  p_phone text default null,
  p_payment_reference text default null,
  p_notes text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_contribution public.contributions%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_performer_name text;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_contribution_id is null then
    raise exception 'Contribution ID is required'
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero'
      using errcode = '22023';
  end if;

  if v_reason is null then
    raise exception 'Add a reason for this edit before saving.'
      using errcode = '22023';
  end if;

  select c.* into v_contribution
  from public.contributions c
  where c.id = p_contribution_id
  for update;

  if v_contribution.id is null then
    raise exception 'Contribution was not found'
      using errcode = 'P0002';
  end if;

  if not (
    public.is_church_admin(v_actor_id, v_contribution.church_id)
    or public.is_super_admin(v_actor_id)
  ) then
    raise exception 'You do not have permission to update this contribution'
      using errcode = '42501';
  end if;

  if p_member_id is not null and not exists (
    select 1
    from public.members m
    where m.id = p_member_id
      and m.church_id = v_contribution.church_id
  ) then
    raise exception 'Member does not belong to this church'
      using errcode = '42501';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.contribution_categories cc
    where cc.id = p_category_id
  ) then
    raise exception 'Contribution category was not found'
      using errcode = '22023';
  end if;

  v_old_values := jsonb_build_object(
    'amount', coalesce(v_contribution.amount, 0),
    'category_id', v_contribution.category_id,
    'donor_name', v_contribution.donor_name,
    'member_id', v_contribution.member_id,
    'phone', v_contribution.phone,
    'payment_reference', v_contribution.payment_reference,
    'notes', v_contribution.notes
  );

  v_new_values := jsonb_build_object(
    'amount', p_amount,
    'category_id', p_category_id,
    'donor_name', nullif(trim(coalesce(p_donor_name, '')), ''),
    'member_id', p_member_id,
    'phone', nullif(trim(coalesce(p_phone, '')), ''),
    'payment_reference', nullif(trim(coalesce(p_payment_reference, '')), ''),
    'notes', nullif(trim(coalesce(p_notes, '')), '')
  );

  select coalesce(
    nullif(trim(p.full_name), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    auth.jwt() ->> 'email'
  )
  into v_performer_name
  from public.profiles p
  where p.id = v_actor_id;

  if v_performer_name is null then
    v_performer_name := coalesce(
      nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
      auth.jwt() ->> 'email'
    );
  end if;

  update public.contributions
  set amount = p_amount,
      category_id = p_category_id,
      donor_name = nullif(trim(coalesce(p_donor_name, '')), ''),
      member_id = p_member_id,
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      payment_reference = nullif(trim(coalesce(p_payment_reference, '')), ''),
      notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = v_contribution.id;

  insert into public.contribution_audit_logs (
    church_id,
    contribution_id,
    action,
    reason,
    old_values,
    new_values,
    performed_by,
    performer_name
  )
  values (
    v_contribution.church_id,
    v_contribution.id,
    'EDIT',
    v_reason,
    v_old_values,
    v_new_values,
    v_actor_id,
    v_performer_name
  );

  return jsonb_build_object(
    'success', true,
    'id', v_contribution.id,
    'old_amount', coalesce(v_contribution.amount, 0),
    'amount', p_amount
  );
end;
$$;

create or replace function public.delete_contribution_with_audit(
  p_contribution_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_contribution public.contributions%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_performer_name text;
  v_old_values jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_contribution_id is null then
    raise exception 'Contribution ID is required'
      using errcode = '22023';
  end if;

  if v_reason is null then
    raise exception 'Add a reason for deletion before continuing.'
      using errcode = '22023';
  end if;

  select c.* into v_contribution
  from public.contributions c
  where c.id = p_contribution_id
  for update;

  if v_contribution.id is null then
    raise exception 'Contribution was not found or has already been deleted'
      using errcode = 'P0002';
  end if;

  if not (
    public.is_church_admin(v_actor_id, v_contribution.church_id)
    or public.is_super_admin(v_actor_id)
  ) then
    raise exception 'You do not have permission to delete this contribution'
      using errcode = '42501';
  end if;

  v_old_values := jsonb_build_object(
    'amount', coalesce(v_contribution.amount, 0),
    'category_id', v_contribution.category_id,
    'donor_name', v_contribution.donor_name,
    'member_id', v_contribution.member_id,
    'phone', v_contribution.phone,
    'payment_reference', v_contribution.payment_reference,
    'notes', v_contribution.notes
  );

  select coalesce(
    nullif(trim(p.full_name), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    auth.jwt() ->> 'email'
  )
  into v_performer_name
  from public.profiles p
  where p.id = v_actor_id;

  if v_performer_name is null then
    v_performer_name := coalesce(
      nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
      auth.jwt() ->> 'email'
    );
  end if;

  insert into public.contribution_audit_logs (
    church_id,
    contribution_id,
    action,
    reason,
    old_values,
    new_values,
    performed_by,
    performer_name
  )
  values (
    v_contribution.church_id,
    v_contribution.id,
    'DELETE',
    v_reason,
    v_old_values,
    null,
    v_actor_id,
    v_performer_name
  );

  delete from public.contributions
  where id = v_contribution.id;

  return jsonb_build_object(
    'success', true,
    'id', v_contribution.id,
    'amount', coalesce(v_contribution.amount, 0)
  );
end;
$$;

grant execute on function public.update_contribution_with_audit(
  uuid,
  numeric,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text
) to authenticated;

grant execute on function public.delete_contribution_with_audit(
  uuid,
  text
) to authenticated;
