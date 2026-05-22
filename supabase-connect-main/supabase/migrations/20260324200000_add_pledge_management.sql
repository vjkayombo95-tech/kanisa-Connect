create table if not exists public.pledges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  amount_pledged numeric(12,2) not null check (amount_pledged > 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  status text not null default 'pending' check (status in ('pending', 'partial', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.pledge_payments (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid not null references public.pledges(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_targets (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null unique references public.communities(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  target_amount numeric(12,2) not null default 0 check (target_amount >= 0),
  total_pledged numeric(12,2) not null default 0 check (total_pledged >= 0),
  total_paid numeric(12,2) not null default 0 check (total_paid >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_pledges_member_id on public.pledges(member_id);
create index if not exists idx_pledges_church_id on public.pledges(church_id);
create index if not exists idx_pledges_community_id on public.pledges(community_id);
create index if not exists idx_pledge_payments_pledge_id on public.pledge_payments(pledge_id);
create index if not exists idx_pledge_payments_member_id on public.pledge_payments(member_id);
create index if not exists idx_community_targets_church_id on public.community_targets(church_id);

alter table public.pledges enable row level security;
alter table public.pledge_payments enable row level security;
alter table public.community_targets enable row level security;

create or replace function public.is_pledge_admin_for_church(_church_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = _church_id
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
  );
$$;

create or replace function public.is_pledge_leader_for_community(_community_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    join public.communities c on c.id = _community_id
    where m.user_id = auth.uid()
      and m.church_id = c.church_id
      and (
        c.chairperson_id = m.id
        or c.vice_chairperson_id = m.id
        or c.treasurer_id = m.id
        or c.secretary_id = m.id
        or c.katibu_id = m.id
      )
  );
$$;

create or replace function public.is_pledge_owner(_member_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.id = _member_id
      and m.user_id = auth.uid()
  );
$$;

grant execute on function public.is_pledge_admin_for_church(uuid) to authenticated;
grant execute on function public.is_pledge_leader_for_community(uuid) to authenticated;
grant execute on function public.is_pledge_owner(uuid) to authenticated;

drop policy if exists "Users can view accessible pledges" on public.pledges;
create policy "Users can view accessible pledges"
on public.pledges
for select
using (
  public.is_pledge_owner(member_id)
  or public.is_pledge_admin_for_church(church_id)
  or (community_id is not null and public.is_pledge_leader_for_community(community_id))
);

drop policy if exists "Users can view accessible pledge payments" on public.pledge_payments;
create policy "Users can view accessible pledge payments"
on public.pledge_payments
for select
using (
  exists (
    select 1
    from public.pledges p
    where p.id = pledge_payments.pledge_id
      and (
        public.is_pledge_owner(p.member_id)
        or public.is_pledge_admin_for_church(p.church_id)
        or (p.community_id is not null and public.is_pledge_leader_for_community(p.community_id))
      )
  )
);

drop policy if exists "Users can view accessible community targets" on public.community_targets;
create policy "Users can view accessible community targets"
on public.community_targets
for select
using (
  public.is_pledge_admin_for_church(church_id)
  or public.is_pledge_leader_for_community(community_id)
);

create or replace function public.create_pledge(
  _member_id uuid,
  _church_id uuid,
  _community_id uuid,
  _amount_pledged numeric,
  _target_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _pledge_id uuid;
  _member_church_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _member_id is null or _church_id is null or _amount_pledged is null or _amount_pledged <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid pledge details');
  end if;

  if not (
    public.is_pledge_admin_for_church(_church_id)
    or (_community_id is not null and public.is_pledge_leader_for_community(_community_id))
    or public.is_pledge_owner(_member_id)
  ) then
    return jsonb_build_object('success', false, 'error', 'Not allowed to create this pledge');
  end if;

  select church_id into _member_church_id
  from public.members
  where id = _member_id;

  if _member_church_id is distinct from _church_id then
    return jsonb_build_object('success', false, 'error', 'Member does not belong to this church');
  end if;

  if _community_id is not null and not exists (
    select 1 from public.communities c where c.id = _community_id and c.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Community does not belong to this church');
  end if;

  insert into public.pledges (member_id, church_id, community_id, amount_pledged, amount_paid, status)
  values (_member_id, _church_id, _community_id, _amount_pledged, 0, 'pending')
  returning id into _pledge_id;

  if _community_id is not null then
    insert into public.community_targets (community_id, church_id, target_amount, total_pledged, total_paid)
    values (_community_id, _church_id, greatest(coalesce(_target_amount, 0), 0), _amount_pledged, 0)
    on conflict (community_id) do update
    set
      target_amount = case
        when _target_amount is null then public.community_targets.target_amount
        else greatest(public.community_targets.target_amount, _target_amount)
      end,
      total_pledged = public.community_targets.total_pledged + excluded.total_pledged;
  end if;

  return jsonb_build_object('success', true, 'pledge_id', _pledge_id);
end;
$$;

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

  if _pledge.amount_paid + _amount > _pledge.amount_pledged then
    return jsonb_build_object('success', false, 'error', 'Payment exceeds the remaining balance');
  end if;

  insert into public.pledge_payments (pledge_id, member_id, amount, payment_method)
  values (_pledge.id, _pledge.member_id, _amount, _payment_method)
  returning id into _payment_id;

  _new_amount_paid := _pledge.amount_paid + _amount;
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
    values (_pledge.community_id, _pledge.church_id, 0, 0, _amount)
    on conflict (community_id) do update
    set total_paid = public.community_targets.total_paid + excluded.total_paid;
  end if;

  return jsonb_build_object(
    'success', true,
    'payment_id', _payment_id,
    'pledge_id', _pledge.id,
    'amount_paid', _new_amount_paid,
    'status', _new_status
  );
end;
$$;

create or replace function public.get_member_pledges(_member_id uuid)
returns table (
  id uuid,
  member_id uuid,
  member_name text,
  church_id uuid,
  community_id uuid,
  community_name text,
  amount_pledged numeric,
  amount_paid numeric,
  balance numeric,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if _member_id is null then
    return;
  end if;

  if not (
    public.is_pledge_owner(_member_id)
    or exists (
      select 1
      from public.members m
      where m.id = _member_id
        and public.is_pledge_admin_for_church(m.church_id)
    )
    or exists (
      select 1
      from public.pledges p
      where p.member_id = _member_id
        and p.community_id is not null
        and public.is_pledge_leader_for_community(p.community_id)
    )
  ) then
    return;
  end if;

  return query
  select
    p.id,
    p.member_id,
    m.full_name as member_name,
    p.church_id,
    p.community_id,
    c.name as community_name,
    p.amount_pledged,
    p.amount_paid,
    greatest(p.amount_pledged - p.amount_paid, 0) as balance,
    p.status,
    p.created_at
  from public.pledges p
  join public.members m on m.id = p.member_id
  left join public.communities c on c.id = p.community_id
  where p.member_id = _member_id
  order by p.created_at desc;
end;
$$;

create or replace function public.get_community_pledges(_community_id uuid)
returns table (
  id uuid,
  member_id uuid,
  member_name text,
  church_id uuid,
  community_id uuid,
  community_name text,
  amount_pledged numeric,
  amount_paid numeric,
  balance numeric,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if _community_id is null then
    return;
  end if;

  if not (
    public.is_pledge_leader_for_community(_community_id)
    or exists (
      select 1
      from public.communities c
      where c.id = _community_id
        and public.is_pledge_admin_for_church(c.church_id)
    )
  ) then
    return;
  end if;

  return query
  select
    p.id,
    p.member_id,
    m.full_name as member_name,
    p.church_id,
    p.community_id,
    c.name as community_name,
    p.amount_pledged,
    p.amount_paid,
    greatest(p.amount_pledged - p.amount_paid, 0) as balance,
    p.status,
    p.created_at
  from public.pledges p
  join public.members m on m.id = p.member_id
  left join public.communities c on c.id = p.community_id
  where p.community_id = _community_id
  order by m.full_name, p.created_at desc;
end;
$$;

create or replace function public.get_church_pledges_summary(_church_id uuid)
returns table (
  community_id uuid,
  community_name text,
  target_amount numeric,
  total_pledged numeric,
  total_paid numeric,
  balance numeric,
  pledge_count bigint,
  completed_count bigint,
  progress_percentage numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if _church_id is null or not public.is_pledge_admin_for_church(_church_id) then
    return;
  end if;

  return query
  select
    c.id as community_id,
    c.name as community_name,
    coalesce(ct.target_amount, 0) as target_amount,
    coalesce(sum(p.amount_pledged), 0) as total_pledged,
    coalesce(sum(p.amount_paid), 0) as total_paid,
    greatest(coalesce(sum(p.amount_pledged), 0) - coalesce(sum(p.amount_paid), 0), 0) as balance,
    count(p.id) as pledge_count,
    count(*) filter (where p.status = 'completed') as completed_count,
    case
      when coalesce(sum(p.amount_pledged), 0) = 0 then 0
      else round((coalesce(sum(p.amount_paid), 0) / sum(p.amount_pledged)) * 100, 2)
    end as progress_percentage
  from public.communities c
  left join public.community_targets ct on ct.community_id = c.id
  left join public.pledges p on p.community_id = c.id
  where c.church_id = _church_id
  group by c.id, c.name, ct.target_amount
  order by c.name;
end;
$$;

grant execute on function public.create_pledge(uuid, uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.make_pledge_payment(uuid, numeric, text) to authenticated;
grant execute on function public.get_member_pledges(uuid) to authenticated;
grant execute on function public.get_community_pledges(uuid) to authenticated;
grant execute on function public.get_church_pledges_summary(uuid) to authenticated;
