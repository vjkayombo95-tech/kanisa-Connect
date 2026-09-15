create or replace function public.generate_church_analytics_snapshot_as_service(
  p_church_id uuid
)
returns public.analytics_snapshots
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_church_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the backend service role may generate automated analytics snapshots.'
      using errcode = '42501';
  end if;

  if p_church_id is null then
    raise exception 'Church id is required.' using errcode = '22023';
  end if;

  select c.status
  into v_church_status
  from public.churches c
  where c.id = p_church_id;

  if v_church_status is null then
    raise exception 'Church not found.' using errcode = 'P0002';
  end if;

  if v_church_status <> 'active' then
    raise exception 'Automated analytics snapshots require an active church.'
      using errcode = '42501';
  end if;

  return public.generate_church_analytics_snapshot_internal(p_church_id, null);
end;
$$;

revoke all on function public.generate_church_analytics_snapshot_as_service(uuid) from public;
revoke all on function public.generate_church_analytics_snapshot_as_service(uuid) from anon;
revoke all on function public.generate_church_analytics_snapshot_as_service(uuid) from authenticated;
grant execute on function public.generate_church_analytics_snapshot_as_service(uuid) to service_role;

create or replace function public.run_active_church_analytics_snapshot_generation()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_church record;
  v_snapshot public.analytics_snapshots%rowtype;
  v_attempted integer := 0;
  v_succeeded integer := 0;
  v_failed integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the backend service role may run automated analytics snapshots.'
      using errcode = '42501';
  end if;

  for v_church in
    select c.id, c.name
    from public.churches c
    where c.status = 'active'
    order by c.id
  loop
    v_attempted := v_attempted + 1;

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
          'error', left(sqlerrm, 240)
        ));
    end;
  end loop;

  return jsonb_build_object(
    'attempted', v_attempted,
    'succeeded', v_succeeded,
    'failed', v_failed,
    'results', v_results
  );
end;
$$;

revoke all on function public.run_active_church_analytics_snapshot_generation() from public;
revoke all on function public.run_active_church_analytics_snapshot_generation() from anon;
revoke all on function public.run_active_church_analytics_snapshot_generation() from authenticated;
grant execute on function public.run_active_church_analytics_snapshot_generation() to service_role;
