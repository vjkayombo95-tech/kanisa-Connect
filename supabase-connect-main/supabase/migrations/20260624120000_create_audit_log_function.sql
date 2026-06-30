-- Phase 4.3 SaaS Audit & Observability: reusable audit logging helper.

create or replace function public.create_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
begin
  select p.role
  into v_actor_role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    description,
    metadata
  )
  values (
    auth.uid(),
    v_actor_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_description,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

grant execute
on function public.create_audit_log(
  text,
  text,
  uuid,
  text,
  jsonb
)
to authenticated;
