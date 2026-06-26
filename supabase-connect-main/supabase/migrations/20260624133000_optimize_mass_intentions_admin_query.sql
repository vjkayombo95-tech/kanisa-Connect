-- RC-1.2.5 Mass Intentions Query Optimization
-- Provides paginated, filtered admin reads without transferring the full church dataset.

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_mass_intentions_church_status_created_at
on public.mass_intentions (church_id, status, created_at desc);

create index if not exists idx_mass_intentions_church_payment_created_at
on public.mass_intentions (church_id, payment_status, created_at desc);

create index if not exists idx_mass_intentions_church_mass_date_created_at
on public.mass_intentions (church_id, mass_date, created_at desc);

create index if not exists idx_mass_intentions_church_mass_time_created_at
on public.mass_intentions (church_id, mass_time, created_at desc);

create index if not exists idx_mass_intentions_admin_search_trgm
on public.mass_intentions
using gin (
  lower(
    coalesce(requested_by_name, '') || ' ' ||
    coalesce(requested_by_phone, '') || ' ' ||
    coalesce(offered_for_name, '') || ' ' ||
    coalesce(intention, '') || ' ' ||
    coalesce(message, '')
  ) extensions.gin_trgm_ops
);

create or replace function public.get_mass_intentions_admin_page(
  p_church_id uuid,
  p_search text default null,
  p_mass_date date default null,
  p_mass_time text default null,
  p_payment_status text default null,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := lower(trim(coalesce(p_search, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_rows jsonb := '[]'::jsonb;
  v_mass_times jsonb := '[]'::jsonb;
  v_total_count integer := 0;
  v_summary jsonb;
begin
  if p_church_id is null then
    raise exception 'Church context is required'
      using errcode = '22023';
  end if;

  if not (
    public.is_super_admin()
    or public.can_manage_church_workspace(auth.uid(), p_church_id)
  ) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  with filtered as (
    select mi.id
    from public.mass_intentions mi
    left join public.members m on m.id = mi.member_id
    where mi.church_id = p_church_id
      and (p_mass_date is null or mi.mass_date = p_mass_date)
      and (p_mass_time is null or p_mass_time = 'all' or coalesce(mi.mass_time, mi.mass_name) = p_mass_time)
      and (p_payment_status is null or p_payment_status = 'all' or mi.payment_status = p_payment_status)
      and (p_status is null or p_status = 'all' or mi.status = p_status)
      and (
        v_search = ''
        or lower(
          coalesce(mi.requested_by_name, '') || ' ' ||
          coalesce(mi.requested_by_phone, '') || ' ' ||
          coalesce(mi.offered_for_name, '') || ' ' ||
          coalesce(mi.intention, '') || ' ' ||
          coalesce(mi.message, '') || ' ' ||
          coalesce(m.full_name, '') || ' ' ||
          coalesce(m.phone, '')
        ) like '%' || v_search || '%'
      )
  )
  select count(*)
  into v_total_count
  from filtered;

  select coalesce(jsonb_agg(row_data order by row_created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      mi.created_at as row_created_at,
      jsonb_build_object(
        'id', mi.id,
        'church_id', mi.church_id,
        'member_id', mi.member_id,
        'requested_by_name', mi.requested_by_name,
        'requested_by_phone', mi.requested_by_phone,
        'offered_for_name', mi.offered_for_name,
        'intention_type', mi.intention_type,
        'intention', mi.intention,
        'message', mi.message,
        'mass_date', mi.mass_date,
        'mass_time', mi.mass_time,
        'mass_name', mi.mass_name,
        'amount', mi.amount,
        'offering_amount', mi.offering_amount,
        'payment_status', mi.payment_status,
        'status', mi.status,
        'proof_image_url', mi.proof_image_url,
        'created_at', mi.created_at,
        'updated_at', mi.updated_at,
        'members', case
          when m.id is null then null
          else jsonb_build_object(
            'full_name', m.full_name,
            'email', m.email,
            'phone', m.phone
          )
        end
      ) as row_data
    from public.mass_intentions mi
    left join public.members m on m.id = mi.member_id
    where mi.church_id = p_church_id
      and (p_mass_date is null or mi.mass_date = p_mass_date)
      and (p_mass_time is null or p_mass_time = 'all' or coalesce(mi.mass_time, mi.mass_name) = p_mass_time)
      and (p_payment_status is null or p_payment_status = 'all' or mi.payment_status = p_payment_status)
      and (p_status is null or p_status = 'all' or mi.status = p_status)
      and (
        v_search = ''
        or lower(
          coalesce(mi.requested_by_name, '') || ' ' ||
          coalesce(mi.requested_by_phone, '') || ' ' ||
          coalesce(mi.offered_for_name, '') || ' ' ||
          coalesce(mi.intention, '') || ' ' ||
          coalesce(mi.message, '') || ' ' ||
          coalesce(m.full_name, '') || ' ' ||
          coalesce(m.phone, '')
        ) like '%' || v_search || '%'
      )
    order by mi.created_at desc
    limit v_limit
    offset v_offset
  ) page_rows;

  select coalesce(jsonb_agg(mass_label order by mass_label), '[]'::jsonb)
  into v_mass_times
  from (
    select distinct coalesce(mi.mass_time, mi.mass_name) as mass_label
    from public.mass_intentions mi
    where mi.church_id = p_church_id
      and coalesce(mi.mass_time, mi.mass_name) is not null
  ) options;

  select jsonb_build_object(
    'today', count(*) filter (where mi.mass_date = current_date),
    'pendingPayment', count(*) filter (where coalesce(mi.payment_status, 'pending') <> 'paid'),
    'approved', count(*) filter (where mi.status in ('approved', 'scheduled')),
    'collected', coalesce(sum(coalesce(mi.amount, mi.offering_amount, 0)) filter (where mi.payment_status = 'paid'), 0)
  )
  into v_summary
  from public.mass_intentions mi
  where mi.church_id = p_church_id;

  return jsonb_build_object(
    'rows', v_rows,
    'count', v_total_count,
    'summary', v_summary,
    'massTimeOptions', v_mass_times
  );
end;
$$;

grant execute on function public.get_mass_intentions_admin_page(
  uuid,
  text,
  date,
  text,
  text,
  text,
  integer,
  integer
) to authenticated;
