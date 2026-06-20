alter table public.app_error_logs
  add column if not exists resolved boolean not null default false,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid null references auth.users(id) on delete set null;

create index if not exists idx_app_error_logs_resolved
  on public.app_error_logs(resolved);

create or replace function public.resolve_app_error_log(p_log_id uuid)
returns public.app_error_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.app_error_logs%rowtype;
begin
  select *
  into v_log
  from public.app_error_logs
  where id = p_log_id;

  if v_log.id is null then
    raise exception 'Log entry not found.';
  end if;

  if not (
    exists (
      select 1
      from public.super_admins sa
      where sa.id = auth.uid()
    )
    or (
      v_log.church_id is not null
      and exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.church_id = v_log.church_id
          and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
      )
    )
  ) then
    raise exception 'You do not have permission to resolve this log.';
  end if;

  update public.app_error_logs
  set resolved = true,
      resolved_at = now(),
      resolved_by = auth.uid(),
      updated_at = now()
  where id = p_log_id
  returning * into v_log;

  return v_log;
end;
$$;

revoke all on function public.resolve_app_error_log(uuid) from public;
grant execute on function public.resolve_app_error_log(uuid) to authenticated;

create or replace function public.delete_old_app_error_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer := 0;
begin
  if not exists (
    select 1
    from public.super_admins sa
    where sa.id = auth.uid()
  ) then
    raise exception 'Only super admins can delete old application logs.';
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
grant execute on function public.delete_old_app_error_logs() to authenticated;
