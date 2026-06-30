-- RC-1.2.2 Global Search Optimization
-- Consolidates Super Admin global search into one authorized RPC.

create or replace function public.global_search(search_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := trim(coalesce(search_text, ''));
  v_pattern text;
  v_churches jsonb := '[]'::jsonb;
  v_users jsonb := '[]'::jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_audits jsonb := '[]'::jsonb;
  v_alerts jsonb := '[]'::jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  if length(v_search) < 3 then
    return jsonb_build_object(
      'churches', v_churches,
      'users', v_users,
      'jobs', v_jobs,
      'audits', v_audits,
      'alerts', v_alerts
    );
  end if;

  v_pattern := '%' || v_search || '%';

  select coalesce(jsonb_agg(result), '[]'::jsonb)
  into v_churches
  from (
    select jsonb_build_object(
      'id', c.id::text,
      'label', coalesce(c.name, c.code, 'Unnamed church'),
      'description', coalesce(nullif(concat_ws(' - ', c.code, c.email), ''), 'Church workspace'),
      'path', '/super-admin/churches'
    ) as result
    from public.churches c
    where c.name ilike v_pattern
       or c.code ilike v_pattern
       or c.email ilike v_pattern
    order by c.created_at desc
    limit 10
  ) matches;

  select coalesce(jsonb_agg(result), '[]'::jsonb)
  into v_users
  from (
    select jsonb_build_object(
      'id', m.id::text,
      'label', coalesce(m.full_name, m.email, m.id::text),
      'description', coalesce(nullif(concat_ws(' - ', m.email, m.phone), ''), 'User record'),
      'path', '/super-admin/activity'
    ) as result
    from public.members m
    where m.full_name ilike v_pattern
       or m.email ilike v_pattern
       or m.phone ilike v_pattern
    order by m.created_at desc
    limit 10
  ) matches;

  select coalesce(jsonb_agg(result), '[]'::jsonb)
  into v_jobs
  from (
    select jsonb_build_object(
      'id', j.id::text,
      'label', j.job_name,
      'description', coalesce(j.description, 'Scheduled job'),
      'path', '/super-admin/system-jobs/' || j.id::text
    ) as result
    from public.system_jobs j
    where j.job_name ilike v_pattern
       or j.description ilike v_pattern
    order by j.job_name asc
    limit 10
  ) matches;

  select coalesce(jsonb_agg(result), '[]'::jsonb)
  into v_audits
  from (
    select jsonb_build_object(
      'id', a.id::text,
      'label', coalesce(a.action, 'Audit log'),
      'description', coalesce(
        a.description,
        nullif(concat_ws(' - ', a.actor_role, a.entity_type), ''),
        'Audit activity'
      ),
      'path', '/super-admin/audit-logs'
    ) as result
    from public.audit_logs a
    where a.action ilike v_pattern
       or a.actor_role ilike v_pattern
       or a.entity_type ilike v_pattern
       or a.description ilike v_pattern
    order by a.created_at desc
    limit 10
  ) matches;

  select coalesce(jsonb_agg(result), '[]'::jsonb)
  into v_alerts
  from (
    select jsonb_build_object(
      'id', s.id::text,
      'label', coalesce(s.title, 'System alert'),
      'description', coalesce(nullif(concat_ws(' - ', s.severity, s.source), ''), 'System alert'),
      'path', '/super-admin/system-health'
    ) as result
    from public.system_alerts s
    where s.severity ilike v_pattern
       or s.title ilike v_pattern
       or s.source ilike v_pattern
    order by s.created_at desc
    limit 10
  ) matches;

  return jsonb_build_object(
    'churches', v_churches,
    'users', v_users,
    'jobs', v_jobs,
    'audits', v_audits,
    'alerts', v_alerts
  );
end;
$$;

grant execute on function public.global_search(text) to authenticated;
