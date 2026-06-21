-- Server-side member contribution summaries for scalable Reports > By Member.

drop function if exists public.get_contributions_by_member(uuid, timestamptz, timestamptz);
drop function if exists public.get_contributions_by_member(uuid, timestamptz, timestamptz, integer);

create or replace function public.get_contributions_by_member(
  p_church_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit integer default 100
)
returns table (
  member_id uuid,
  member_name text,
  phone text,
  total_amount numeric,
  contribution_count bigint,
  last_contribution_date timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_church_id is null then
    raise exception 'Church is required.';
  end if;

  if not (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = p_church_id
        and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
    )
  ) then
    raise exception 'You do not have permission to view member contribution reports for this church.';
  end if;

  return query
  select
    summary.member_id,
    summary.member_name,
    summary.phone,
    summary.total_amount,
    summary.contribution_count,
    summary.last_contribution_date
  from (
    select
      c.member_id::uuid as member_id,
      coalesce(nullif(btrim(m.full_name), ''), nullif(btrim(c.donor_name), ''), 'Anonymous')::text as member_name,
      coalesce(nullif(btrim(m.phone), ''), nullif(btrim(c.phone), ''))::text as phone,
      coalesce(sum(c.amount), 0)::numeric as total_amount,
      count(*)::bigint as contribution_count,
      max(c.created_at)::timestamptz as last_contribution_date
    from public.contributions c
    left join public.members m
      on m.id = c.member_id
      and m.church_id = c.church_id
    where c.church_id = p_church_id
      and c.created_at >= p_start_date
      and c.created_at < p_end_date
    group by
      c.member_id,
      coalesce(nullif(btrim(m.full_name), ''), nullif(btrim(c.donor_name), ''), 'Anonymous'),
      coalesce(nullif(btrim(m.phone), ''), nullif(btrim(c.phone), ''))
  ) summary
  order by summary.total_amount desc, summary.last_contribution_date desc
  limit v_limit;
end;
$$;

revoke all on function public.get_contributions_by_member(uuid, timestamptz, timestamptz, integer) from public;
grant execute on function public.get_contributions_by_member(uuid, timestamptz, timestamptz, integer) to authenticated;

create index if not exists idx_contributions_church_created_at_member_report
  on public.contributions(church_id, created_at desc, member_id);

notify pgrst, 'reload schema';
