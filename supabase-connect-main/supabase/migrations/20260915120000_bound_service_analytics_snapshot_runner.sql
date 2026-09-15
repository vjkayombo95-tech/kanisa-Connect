revoke all on function public.generate_church_analytics_snapshot_internal(uuid, uuid) from service_role;

drop function if exists public.run_active_church_analytics_snapshot_generation();

create or replace function public.run_active_church_analytics_snapshot_generation(
  p_after_church_id uuid default null,
  p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_church record;
  v_snapshot public.analytics_snapshots%rowtype;
  v_default_limit constant integer := 25;
  v_max_limit constant integer := 100;
  v_effective_limit integer := least(greatest(coalesce(p_limit, v_default_limit), 1), v_max_limit);
  v_seen integer := 0;
  v_attempted integer := 0;
  v_succeeded integer := 0;
  v_failed integer := 0;
  v_has_more boolean := false;
  v_next_cursor uuid := null;
  v_results jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the backend service role may run automated analytics snapshots.'
      using errcode = '42501';
  end if;

  if not pg_try_advisory_xact_lock(
    hashtextextended('run_active_church_analytics_snapshot_generation', 0)
  ) then
    return jsonb_build_object(
      'attempted', 0,
      'succeeded', 0,
      'failed', 0,
      'has_more', false,
      'next_cursor', p_after_church_id,
      'effective_limit', v_effective_limit,
      'already_running', true,
      'results', '[]'::jsonb
    );
  end if;

  for v_church in
    select c.id
    from public.churches c
    where c.status = 'active'
      and (p_after_church_id is null or c.id > p_after_church_id)
    order by c.id
    limit v_effective_limit + 1
  loop
    v_seen := v_seen + 1;

    if v_seen > v_effective_limit then
      v_has_more := true;
      exit;
    end if;

    v_attempted := v_attempted + 1;
    v_next_cursor := v_church.id;

    begin
      v_snapshot := public.generate_church_analytics_snapshot_as_service(v_church.id);
      v_succeeded := v_succeeded + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'churchId', v_church.id,
        'status', 'succeeded',
        'snapshotId', v_snapshot.id
      ));
    exception
      when others then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'churchId', v_church.id,
          'status', 'failed',
          'errorCode', sqlstate,
          'message', case
            when sqlstate = '42501' then 'not_allowed'
            when sqlstate = 'P0002' then 'not_found'
            else 'generation_failed'
          end
        ));
    end;
  end loop;

  return jsonb_build_object(
    'attempted', v_attempted,
    'succeeded', v_succeeded,
    'failed', v_failed,
    'has_more', v_has_more,
    'next_cursor', v_next_cursor,
    'effective_limit', v_effective_limit,
    'already_running', false,
    'results', v_results
  );
end;
$$;

revoke all on function public.run_active_church_analytics_snapshot_generation(uuid, integer) from public;
revoke all on function public.run_active_church_analytics_snapshot_generation(uuid, integer) from anon;
revoke all on function public.run_active_church_analytics_snapshot_generation(uuid, integer) from authenticated;
grant execute on function public.run_active_church_analytics_snapshot_generation(uuid, integer) to service_role;
