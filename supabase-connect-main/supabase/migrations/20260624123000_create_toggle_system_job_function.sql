create or replace function public.toggle_system_job(
  p_job_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only super admins can toggle system jobs';
  end if;

  update public.system_jobs
  set
    enabled = p_enabled,
    updated_at = now()
  where id = p_job_id;
end;
$$;

grant execute
on function public.toggle_system_job(uuid, boolean)
to authenticated;
