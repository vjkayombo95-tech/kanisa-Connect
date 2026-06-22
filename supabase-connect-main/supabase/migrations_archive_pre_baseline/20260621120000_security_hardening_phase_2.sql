-- Phase 2 security hardening: pastoral privacy, verified pledge payments, and
-- abuse-resistant public giving. Existing recorded pledge payments are retained
-- as approved historical records; all new submissions start pending.

create or replace function public.can_review_pastoral_requests(p_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_church_id is not null and (
    public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = p_church_id
        and ur.role::text in ('church_admin', 'pastor')
    )
    or exists (
      select 1 from public.churches c
      where c.id = p_church_id and c.created_by = auth.uid()
    )
  );
$$;

revoke all on function public.can_review_pastoral_requests(uuid) from public;
grant execute on function public.can_review_pastoral_requests(uuid) to authenticated;

alter table public.prayer_requests
  add column if not exists privacy text not null default 'public_to_church';

-- Earlier schema versions used an enum with active/answered/archived while
-- the application has long used pending/approved/rejected. Normalize safely.
alter table public.prayer_requests alter column status drop default;
alter table public.prayer_requests
  alter column status type text using (
    case status::text
      when 'active' then 'approved'
      when 'answered' then 'approved'
      when 'archived' then 'rejected'
      else status::text
    end
  );
alter table public.prayer_requests alter column status set default 'pending';
alter table public.prayer_requests drop constraint if exists prayer_requests_status_check;
alter table public.prayer_requests add constraint prayer_requests_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.prayer_requests
  drop constraint if exists prayer_requests_privacy_check;
alter table public.prayer_requests
  add constraint prayer_requests_privacy_check
  check (privacy in ('public_to_church', 'private_to_pastor_admin', 'anonymous_public'));

drop policy if exists "Church members can view prayer requests" on public.prayer_requests;
drop policy if exists "Members can create own prayer requests" on public.prayer_requests;
drop policy if exists "Members can update own prayer requests" on public.prayer_requests;
drop policy if exists "Church admins can manage prayer requests" on public.prayer_requests;
drop policy if exists "Members can delete own pending prayer requests" on public.prayer_requests;

create policy "Members read approved shared prayers or their own"
on public.prayer_requests for select to authenticated using (
  public.can_review_pastoral_requests(church_id)
  or exists (
    select 1 from public.members m
    where m.id = prayer_requests.member_id and m.user_id = auth.uid()
  )
  or (
    status = 'approved'
    and privacy in ('public_to_church', 'anonymous_public')
    and public.is_church_member(auth.uid(), church_id)
  )
);

create policy "Members create their own pending prayers"
on public.prayer_requests for insert to authenticated with check (
  status = 'pending'
  and privacy in ('public_to_church', 'private_to_pastor_admin', 'anonymous_public')
  and exists (
    select 1 from public.members m
    where m.id = prayer_requests.member_id
      and m.church_id = prayer_requests.church_id
      and m.user_id = auth.uid()
  )
);

create policy "Members edit their own pending prayers"
on public.prayer_requests for update to authenticated using (
  status = 'pending'
  and exists (select 1 from public.members m where m.id = prayer_requests.member_id and m.user_id = auth.uid())
) with check (
  status = 'pending'
  and exists (select 1 from public.members m where m.id = prayer_requests.member_id and m.user_id = auth.uid())
);

create policy "Pastoral reviewers manage church prayers"
on public.prayer_requests for update to authenticated using (
  public.can_review_pastoral_requests(church_id)
) with check (
  public.can_review_pastoral_requests(church_id)
);

create policy "Members delete their own pending prayers"
on public.prayer_requests for delete to authenticated using (
  status = 'pending'
  and exists (select 1 from public.members m where m.id = prayer_requests.member_id and m.user_id = auth.uid())
);

alter table public.mass_intentions
  add column if not exists member_id uuid references public.members(id) on delete set null;

alter table public.mass_intentions alter column status drop default;
alter table public.mass_intentions alter column status type text using status::text;
alter table public.mass_intentions alter column status set default 'pending';
alter table public.mass_intentions drop constraint if exists mass_intentions_status_check;
alter table public.mass_intentions add constraint mass_intentions_status_check
  check (status in ('pending', 'approved', 'rejected', 'scheduled', 'completed', 'archived'));

drop policy if exists "Church members can view mass intentions" on public.mass_intentions;
drop policy if exists "Members can create own mass intentions" on public.mass_intentions;
drop policy if exists "Members can update own mass intentions" on public.mass_intentions;
drop policy if exists "Church admins can manage mass intentions" on public.mass_intentions;

create policy "Members read their own mass intentions"
on public.mass_intentions for select to authenticated using (
  public.can_review_pastoral_requests(church_id)
  or exists (select 1 from public.members m where m.id = mass_intentions.member_id and m.user_id = auth.uid())
);

create policy "Members create their own pending mass intentions"
on public.mass_intentions for insert to authenticated with check (
  status = 'pending'
  and exists (
    select 1 from public.members m
    where m.id = mass_intentions.member_id
      and m.church_id = mass_intentions.church_id
      and m.user_id = auth.uid()
  )
);

create policy "Members edit their own pending mass intentions"
on public.mass_intentions for update to authenticated using (
  status = 'pending'
  and exists (select 1 from public.members m where m.id = mass_intentions.member_id and m.user_id = auth.uid())
) with check (
  status = 'pending'
  and exists (select 1 from public.members m where m.id = mass_intentions.member_id and m.user_id = auth.uid())
);

create policy "Pastoral reviewers manage mass intentions"
on public.mass_intentions for update to authenticated using (
  public.can_review_pastoral_requests(church_id)
) with check (
  public.can_review_pastoral_requests(church_id)
);

alter table public.pledge_payments
  add column if not exists transaction_id text,
  add column if not exists proof_url text,
  add column if not exists verification_status text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_reason text;

update public.pledge_payments
set verification_status = 'approved'
where verification_status is null;

alter table public.pledge_payments
  alter column verification_status set default 'pending',
  alter column verification_status set not null;

alter table public.pledge_payments
  drop constraint if exists pledge_payments_verification_status_check;
alter table public.pledge_payments
  add constraint pledge_payments_verification_status_check
  check (verification_status in ('pending', 'approved', 'rejected'));

do $$
begin
  if not exists (
    select 1 from public.pledge_payments
    where nullif(btrim(transaction_id), '') is not null
    group by lower(btrim(transaction_id)) having count(*) > 1
  ) then
    create unique index if not exists pledge_payments_transaction_id_unique_idx
      on public.pledge_payments (lower(btrim(transaction_id)))
      where nullif(btrim(transaction_id), '') is not null;
  else
    raise warning 'Skipped pledge payment transaction index because historical duplicates exist.';
  end if;
end;
$$;

drop function if exists public.make_pledge_payment(uuid, numeric, text);
create or replace function public.make_pledge_payment(
  _pledge_id uuid,
  _amount numeric,
  _payment_method text,
  _transaction_id text default null,
  _proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _pledge public.pledges%rowtype;
  _payment_id uuid;
  _transaction_id_normalized text := nullif(btrim(coalesce(_transaction_id, '')), '');
  _proof_url_normalized text := nullif(btrim(coalesce(_proof_url, '')), '');
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required.');
  end if;
  if _pledge_id is null or _amount is null or _amount <= 0 or coalesce(btrim(_payment_method), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Enter valid payment details.');
  end if;
  if _transaction_id_normalized is null and _proof_url_normalized is null then
    return jsonb_build_object('success', false, 'error', 'Provide a transaction ID or payment proof before submitting.');
  end if;
  if _transaction_id_normalized is not null and _transaction_id_normalized !~ '^[A-Za-z0-9._-]{4,80}$' then
    return jsonb_build_object('success', false, 'error', 'Enter a valid transaction ID.');
  end if;

  select * into _pledge from public.pledges where id = _pledge_id for update;
  if _pledge.id is null then return jsonb_build_object('success', false, 'error', 'Pledge not found.'); end if;
  if not (
    public.is_pledge_owner(_pledge.member_id)
    or public.is_pledge_admin_for_church(_pledge.church_id)
    or (_pledge.community_id is not null and public.is_pledge_leader_for_community(_pledge.community_id))
  ) then return jsonb_build_object('success', false, 'error', 'Not allowed to submit this payment.'); end if;
  if _amount > (_pledge.amount_pledged - _pledge.amount_paid) / 0.99 then
    return jsonb_build_object('success', false, 'error', 'Payment exceeds the remaining pledge balance.');
  end if;
  if _transaction_id_normalized is not null and exists (
    select 1 from public.pledge_payments pp where lower(btrim(pp.transaction_id)) = lower(_transaction_id_normalized)
  ) then return jsonb_build_object('success', false, 'error', 'This transaction has already been submitted.'); end if;

  insert into public.pledge_payments (pledge_id, member_id, amount, payment_method, transaction_id, proof_url, verification_status)
  values (_pledge.id, _pledge.member_id, _amount, btrim(_payment_method), _transaction_id_normalized, _proof_url_normalized, 'pending')
  returning id into _payment_id;
  return jsonb_build_object('success', true, 'payment_id', _payment_id, 'status', 'pending', 'message', 'Payment submitted for verification.');
end;
$$;

create or replace function public.review_pledge_payment(
  _payment_id uuid,
  _approve boolean,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _payment public.pledge_payments%rowtype;
  _pledge public.pledges%rowtype;
  _fee numeric(12,2);
  _net numeric(12,2);
  _new_paid numeric(12,2);
begin
  select pp.* into _payment from public.pledge_payments pp where pp.id = _payment_id for update;
  if _payment.id is null then return jsonb_build_object('success', false, 'error', 'Payment not found.'); end if;
  select * into _pledge from public.pledges where id = _payment.pledge_id for update;
  if not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = _pledge.church_id
        and ur.role::text in ('church_admin', 'pastor')
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'Not authorized to review this payment.');
  end if;
  if _payment.verification_status <> 'pending' then
    return jsonb_build_object('success', false, 'error', 'This payment has already been reviewed.');
  end if;
  if not _approve then
    update public.pledge_payments set verification_status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_reason = nullif(btrim(_reason), '') where id = _payment.id;
    return jsonb_build_object('success', true, 'status', 'rejected');
  end if;
  _fee := round(_payment.amount * 0.01, 2);
  _net := round(_payment.amount - _fee, 2);
  if _pledge.amount_paid + _net > _pledge.amount_pledged then
    return jsonb_build_object('success', false, 'error', 'Approval would exceed the pledge balance.');
  end if;
  update public.pledge_payments set verification_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_reason = nullif(btrim(_reason), '') where id = _payment.id;
  insert into public.platform_fees (church_id, source_type, source_id, gross_amount, fee_percentage, fee_amount, net_amount, member_id)
  values (_pledge.church_id, 'pledge_payment', _payment.id, _payment.amount, 1, _fee, _net, _pledge.member_id);
  _new_paid := _pledge.amount_paid + _net;
  update public.pledges set amount_paid = _new_paid, status = case when _new_paid < _pledge.amount_pledged then 'partial' else 'completed' end where id = _pledge.id;
  if _pledge.community_id is not null then
    update public.community_targets set total_paid = total_paid + _net where community_id = _pledge.community_id;
  end if;
  return jsonb_build_object('success', true, 'status', 'approved', 'net_amount', _net);
end;
$$;

revoke all on function public.make_pledge_payment(uuid, numeric, text, text, text) from public;
grant execute on function public.make_pledge_payment(uuid, numeric, text, text, text) to authenticated;
revoke all on function public.review_pledge_payment(uuid, boolean, text) from public;
grant execute on function public.review_pledge_payment(uuid, boolean, text) to authenticated;

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(), event_type text not null,
  church_id uuid references public.churches(id) on delete set null,
  scope_key text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.security_audit_events enable row level security;
create index if not exists security_audit_events_event_created_idx on public.security_audit_events(event_type, created_at desc);

create or replace function public.submit_public_contribution(
  p_church_slug_or_id text, p_contribution_type text, p_amount numeric,
  p_donor_name text, p_phone text, p_note text default null, p_transaction_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_church_id uuid; v_category_id uuid; v_type text := nullif(btrim(coalesce(p_contribution_type, '')), '');
  v_donor_name text := nullif(btrim(coalesce(p_donor_name, '')), ''); v_phone text := regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g');
  v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_reference text := nullif(btrim(coalesce(p_transaction_id, '')), ''); v_scope text;
begin
  select church.id into v_church_id from public.get_public_giving_church(p_church_slug_or_id) church limit 1;
  if v_church_id is null then return jsonb_build_object('success', false, 'error', 'We could not accept this submission.'); end if;
  v_scope := v_church_id::text || ':' || lower(coalesce(v_phone, '')) || ':' || lower(coalesce(v_reference, ''));
  if v_type is null or v_type not in ('Sadaka', 'Zaka', 'Jengo', 'Shukrani', 'Special Contribution') or p_amount is null or p_amount <= 0 or p_amount > 100000000 or v_donor_name is null or length(v_donor_name) < 2 or v_phone !~ '^\+?[0-9]{9,15}$' or (v_reference is not null and v_reference !~ '^[A-Za-z0-9._-]{4,80}$') then
    insert into public.security_audit_events(event_type, church_id, scope_key, metadata) values ('public_contribution_rejected', v_church_id, v_scope, jsonb_build_object('reason', 'validation_failed'));
    return jsonb_build_object('success', false, 'error', 'We could not accept this submission. Please check your details.');
  end if;
  if v_reference is not null and exists (select 1 from public.contributions c where c.church_id = v_church_id and lower(btrim(c.payment_reference)) = lower(v_reference)) then
    return jsonb_build_object('success', true, 'message', 'This contribution was already received and is awaiting confirmation.');
  end if;
  begin
    perform public.enforce_rate_limit('public_contribution', v_scope, 3, interval '15 minutes');
  exception when others then
    insert into public.security_audit_events(event_type, church_id, scope_key, metadata) values ('public_contribution_rate_limited', v_church_id, v_scope, '{}'::jsonb);
    return jsonb_build_object('success', false, 'error', 'Too many submissions. Please wait and try again.');
  end;
  select cc.id into v_category_id from public.contribution_categories cc where cc.church_id = v_church_id and lower(cc.name) = lower(case v_type when 'Sadaka' then 'Offering' when 'Zaka' then 'Tithe' when 'Jengo' then 'Building Fund' else 'Donations' end) limit 1;
  insert into public.contributions(church_id, amount, category_id, donor_name, phone, payment_reference, notes, currency, date, created_by)
  values (v_church_id, p_amount, v_category_id, left(v_donor_name,160), left(v_phone,32), left(v_reference,120), left(concat_ws(E'\n','Public QR giving submission - pending confirmation','Type: ' || v_type, case when v_note is not null then 'Note: ' || v_note end),1000), 'TZS', current_date, null);
  return jsonb_build_object('success', true, 'message', 'Thank you. Your contribution has been submitted for confirmation.');
end; $$;

revoke all on function public.submit_public_contribution(text, text, numeric, text, text, text, text) from public;
grant execute on function public.submit_public_contribution(text, text, numeric, text, text, text, text) to anon, authenticated;
