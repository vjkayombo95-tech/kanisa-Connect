alter table public.app_error_logs enable row level security;

drop policy if exists "Admins can read app error logs" on public.app_error_logs;
drop policy if exists "Platform super admins can read app error logs" on public.app_error_logs;
create policy "Platform super admins can read app error logs"
on public.app_error_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.super_admins sa
    where sa.id = auth.uid()
  )
);

-- Keep direct table inserts blocked. Frontend logging must use public.log_app_error().
drop policy if exists "Application can insert app error logs" on public.app_error_logs;

create or replace function public.resolve_app_error_log(p_log_id uuid)
returns public.app_error_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.app_error_logs%rowtype;
begin
  if not (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.super_admins sa
      where sa.id = auth.uid()
    )
  ) then
    raise exception 'Only platform super admins can resolve application logs.';
  end if;

  update public.app_error_logs
  set resolved = true,
      resolved_at = now(),
      resolved_by = auth.uid(),
      updated_at = now()
  where id = p_log_id
  returning * into v_log;

  if v_log.id is null then
    raise exception 'Log entry not found.';
  end if;

  return v_log;
end;
$$;

revoke all on function public.resolve_app_error_log(uuid) from public;
grant execute on function public.resolve_app_error_log(uuid) to authenticated, service_role;

create or replace function public.delete_old_app_error_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer := 0;
begin
  if not (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.super_admins sa
      where sa.id = auth.uid()
    )
  ) then
    raise exception 'Only platform super admins can delete old application logs.';
  end if;

  delete from public.app_error_logs
  where (
      level = 'info'
      and created_at < now() - interval '14 days'
    )
    or (
      level = 'warning'
      and created_at < now() - interval '30 days'
    )
    or (
      level = 'error'
      and created_at < now() - interval '90 days'
      and resolved = true
    );

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke all on function public.delete_old_app_error_logs() from public;
grant execute on function public.delete_old_app_error_logs() to authenticated, service_role;
