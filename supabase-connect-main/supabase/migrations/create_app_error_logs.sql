create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('error', 'warning', 'info')),
  message text not null,
  stack text,
  page text,
  route text,
  component text,
  function_name text,
  church_id uuid null references public.churches(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  browser_info text,
  occurrence_count integer not null default 1,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_error_logs_created_at
  on public.app_error_logs(created_at desc);

create index if not exists idx_app_error_logs_level
  on public.app_error_logs(level);

create index if not exists idx_app_error_logs_church_id
  on public.app_error_logs(church_id);

create index if not exists idx_app_error_logs_user_id
  on public.app_error_logs(user_id);

create index if not exists idx_app_error_logs_dedupe
  on public.app_error_logs(message, component, route, created_at desc);

create index if not exists idx_app_error_logs_resolved
  on public.app_error_logs(resolved);

alter table public.app_error_logs enable row level security;

drop policy if exists "Admins can read app error logs" on public.app_error_logs;
create policy "Admins can read app error logs"
on public.app_error_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.super_admins sa
    where sa.id = auth.uid()
  )
  or (
    church_id is not null
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = app_error_logs.church_id
        and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
    )
  )
);

drop policy if exists "Application can insert app error logs" on public.app_error_logs;

create index if not exists idx_app_error_logs_rate_user
  on public.app_error_logs(user_id, created_at desc);

create index if not exists idx_app_error_logs_rate_church
  on public.app_error_logs(church_id, created_at desc);

create index if not exists idx_app_error_logs_rate_session
  on public.app_error_logs((metadata->>'logger_session_id'), created_at desc);

create or replace function public.log_app_error(
  p_level text,
  p_message text,
  p_stack text default null,
  p_page text default null,
  p_route text default null,
  p_component text default null,
  p_function_name text default null,
  p_church_id uuid default null,
  p_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_browser_info text default null
)
returns public.app_error_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_log public.app_error_logs%rowtype;
  v_actor_id uuid := coalesce(p_user_id, auth.uid());
  v_session_id text := nullif(coalesce(p_metadata->>'logger_session_id', p_metadata->>'session_id', ''), '');
  v_recent_count integer := 0;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if p_level not in ('error', 'warning', 'info') then
    p_level := 'error';
  end if;

  p_message := left(coalesce(nullif(trim(p_message), ''), 'Unknown application log'), 1000);
  p_stack := case when p_stack is null then null else left(p_stack, 8000) end;
  p_page := case when p_page is null then null else left(p_page, 250) end;
  p_route := case when p_route is null then null else left(p_route, 500) end;
  p_component := case when p_component is null then null else left(p_component, 250) end;
  p_function_name := case when p_function_name is null then null else left(p_function_name, 250) end;
  p_browser_info := case when p_browser_info is null then null else left(p_browser_info, 1000) end;

  if length(v_metadata::text) > 6000 then
    v_metadata := jsonb_build_object(
      'truncated', true,
      'logger_session_id', v_session_id,
      'preview', left(v_metadata::text, 6000)
    );
  end if;

  if v_actor_id is not null then
    select count(*)
    into v_recent_count
    from public.app_error_logs
    where user_id = v_actor_id
      and created_at >= now() - interval '1 hour';

    if v_recent_count >= 30 then
      return null;
    end if;
  end if;

  if p_church_id is not null then
    select count(*)
    into v_recent_count
    from public.app_error_logs
    where church_id = p_church_id
      and created_at >= now() - interval '1 hour';

    if v_recent_count >= 100 then
      return null;
    end if;
  end if;

  if v_actor_id is null and v_session_id is not null then
    select count(*)
    into v_recent_count
    from public.app_error_logs
    where metadata->>'logger_session_id' = v_session_id
      and created_at >= now() - interval '1 hour';

    if v_recent_count >= 20 then
      return null;
    end if;
  end if;

  select id
  into v_existing_id
  from public.app_error_logs
  where message = p_message
    and coalesce(component, '') = coalesce(p_component, '')
    and coalesce(route, '') = coalesce(p_route, '')
    and created_at >= now() - interval '5 minutes'
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    update public.app_error_logs
    set occurrence_count = occurrence_count + 1,
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || v_metadata
    where id = v_existing_id
    returning * into v_log;

    return v_log;
  end if;

  insert into public.app_error_logs (
    level,
    message,
    stack,
    page,
    route,
    component,
    function_name,
    church_id,
    user_id,
    metadata,
    browser_info
  )
  values (
    p_level,
    p_message,
    p_stack,
    p_page,
    p_route,
    p_component,
    p_function_name,
    p_church_id,
    v_actor_id,
    v_metadata,
    p_browser_info
  )
  returning * into v_log;

  return v_log;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.log_app_error(text, text, text, text, text, text, text, uuid, uuid, jsonb, text) from public;
grant execute on function public.log_app_error(text, text, text, text, text, text, text, uuid, uuid, jsonb, text) to anon, authenticated;
