create or replace function public.generate_church_analytics_snapshot_internal(
  p_church_id uuid,
  p_generated_by uuid default null
)
returns public.analytics_snapshots
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_month_start timestamptz := date_trunc('month', now());
  v_next_month timestamptz := date_trunc('month', now()) + interval '1 month';
  v_last_month_start timestamptz := date_trunc('month', now()) - interval '1 month';
  v_six_months_ago timestamptz := date_trunc('month', now()) - interval '5 months';
  v_this_total numeric := 0;
  v_last_total numeric := 0;
  v_total_contributions numeric := 0;
  v_transaction_count integer := 0;
  v_category_count integer := 0;
  v_active_members integer := 0;
  v_new_members integer := 0;
  v_pledged_total numeric := 0;
  v_pledge_paid_total numeric := 0;
  v_payload jsonb;
  v_snapshot public.analytics_snapshots%rowtype;
begin
  if p_church_id is null then
    raise exception 'Church id is required.' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0), count(*), count(distinct category_id)
  into v_this_total, v_transaction_count, v_category_count
  from public.contributions
  where church_id = p_church_id
    and created_at >= v_month_start
    and created_at < v_next_month;

  select coalesce(sum(amount), 0)
  into v_last_total
  from public.contributions
  where church_id = p_church_id
    and created_at >= v_last_month_start
    and created_at < v_month_start;

  select coalesce(sum(amount), 0)
  into v_total_contributions
  from public.contributions
  where church_id = p_church_id;

  select count(*)
  into v_active_members
  from public.members
  where church_id = p_church_id
    and status = 'active';

  select count(*)
  into v_new_members
  from public.members
  where church_id = p_church_id
    and created_at >= v_month_start
    and created_at < v_next_month;

  select coalesce(sum(amount_pledged), 0), coalesce(sum(amount_paid), 0)
  into v_pledged_total, v_pledge_paid_total
  from public.pledges
  where church_id = p_church_id;

  v_payload := jsonb_build_object(
    'generatedAt', v_now,
    'thisTotal', v_this_total,
    'lastTotal', v_last_total,
    'totalContributions', v_total_contributions,
    'transactionCount', v_transaction_count,
    'categoryCount', v_category_count,
    'overallChange', case when v_last_total > 0 then ((v_this_total - v_last_total) / v_last_total) * 100 else 0 end,
    'activeMembers', v_active_members,
    'newMembers', v_new_members,
    'pledgeTotals', jsonb_build_object(
      'pledged', v_pledged_total,
      'paid', v_pledge_paid_total,
      'balance', greatest(v_pledged_total - v_pledge_paid_total, 0)
    ),
    'monthlyContributions', (
      select coalesce(jsonb_agg(month_row order by month_row->>'month'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'month', to_char(month_bucket, 'Mon YY'),
          'amount', coalesce(total_amount, 0)
        ) as month_row
        from (
          select date_trunc('month', gs)::date as month_bucket
          from generate_series(v_six_months_ago, v_month_start, interval '1 month') gs
        ) months
        left join (
          select date_trunc('month', created_at)::date as month_bucket, sum(amount) as total_amount
          from public.contributions
          where church_id = p_church_id
            and created_at >= v_six_months_ago
          group by 1
        ) totals using (month_bucket)
      ) rows
    ),
    'trendData', (
      select coalesce(jsonb_agg(month_row order by month_row->>'month'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'month', to_char(month_bucket, 'Mon YY'),
          'amount', coalesce(total_amount, 0)
        ) as month_row
        from (
          select date_trunc('month', gs)::date as month_bucket
          from generate_series(v_six_months_ago, v_month_start, interval '1 month') gs
        ) months
        left join (
          select date_trunc('month', created_at)::date as month_bucket, sum(amount) as total_amount
          from public.contributions
          where church_id = p_church_id
            and created_at >= v_six_months_ago
          group by 1
        ) totals using (month_bucket)
      ) rows
    ),
    'topCategories', (
      select coalesce(jsonb_agg(jsonb_build_object('name', category_name, 'total', total_amount) order by total_amount desc), '[]'::jsonb)
      from (
        select coalesce(cc.name, 'Uncategorized') as category_name, sum(c.amount) as total_amount
        from public.contributions c
        left join public.contribution_categories cc on cc.id = c.category_id
        where c.church_id = p_church_id
          and c.created_at >= v_month_start
          and c.created_at < v_next_month
        group by coalesce(cc.name, 'Uncategorized')
        order by total_amount desc
        limit 10
      ) categories
    ),
    'categoryComparison', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', name,
        'thisMonth', this_month,
        'lastMonth', last_month,
        'change', case when last_month > 0 then ((this_month - last_month) / last_month) * 100 else 0 end
      ) order by this_month desc), '[]'::jsonb)
      from (
        select
          coalesce(current_categories.name, previous_categories.name) as name,
          coalesce(current_categories.total_amount, 0) as this_month,
          coalesce(previous_categories.total_amount, 0) as last_month
        from (
          select coalesce(cc.name, 'Uncategorized') as name, sum(c.amount) as total_amount
          from public.contributions c
          left join public.contribution_categories cc on cc.id = c.category_id
          where c.church_id = p_church_id
            and c.created_at >= v_month_start
            and c.created_at < v_next_month
          group by coalesce(cc.name, 'Uncategorized')
        ) current_categories
        full outer join (
          select coalesce(cc.name, 'Uncategorized') as name, sum(c.amount) as total_amount
          from public.contributions c
          left join public.contribution_categories cc on cc.id = c.category_id
          where c.church_id = p_church_id
            and c.created_at >= v_last_month_start
            and c.created_at < v_month_start
          group by coalesce(cc.name, 'Uncategorized')
        ) previous_categories using (name)
      ) comparison
    ),
    'recentTrends', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day, 'amount', total_amount) order by day), '[]'::jsonb)
      from (
        select created_at::date as day, sum(amount) as total_amount
        from public.contributions
        where church_id = p_church_id
          and created_at >= now() - interval '30 days'
        group by created_at::date
        order by day
      ) daily
    ),
    'jumuiyaData', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'members', member_count) order by name), '[]'::jsonb)
      from (
        select c.name, count(m.id) as member_count
        from public.communities c
        left join public.members m on m.community_id = c.id
        where c.church_id = p_church_id
        group by c.id, c.name
        order by c.name
      ) communities
    )
  );

  insert into public.analytics_snapshots (
    church_id,
    snapshot_type,
    period_start,
    period_end,
    payload,
    generated_by
  )
  values (
    p_church_id,
    'monthly_overview',
    v_month_start,
    v_next_month,
    v_payload,
    p_generated_by
  )
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;

revoke all on function public.generate_church_analytics_snapshot_internal(uuid, uuid) from public;
revoke all on function public.generate_church_analytics_snapshot_internal(uuid, uuid) from anon;
revoke all on function public.generate_church_analytics_snapshot_internal(uuid, uuid) from authenticated;

create or replace function public.generate_church_analytics_snapshot(p_church_id uuid)
returns public.analytics_snapshots
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if p_church_id is null then
    raise exception 'Church id is required.' using errcode = '22023';
  end if;

  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.church_id = p_church_id
      and ur.user_id = v_user_id
      and ur.role in ('church_admin', 'pastor', 'admin')
  ) then
    raise exception 'You do not have permission to generate analytics for this church.' using errcode = '42501';
  end if;

  perform public.enforce_rate_limit('analytics_snapshot', p_church_id::text, 3, interval '1 hour');

  return public.generate_church_analytics_snapshot_internal(p_church_id, v_user_id);
end;
$$;

revoke all on function public.generate_church_analytics_snapshot(uuid) from public;
revoke all on function public.generate_church_analytics_snapshot(uuid) from anon;
grant execute on function public.generate_church_analytics_snapshot(uuid) to authenticated;
