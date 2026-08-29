-- Preserve Event ownership scope while using permission-driven authorization.
-- An actor with events:edit may edit their own Event. Cross-owner maintenance
-- additionally requires events:manage. No role identity is special-cased.

drop policy if exists "Church managers can insert events" on public.events;
create policy "Church managers can insert events"
on public.events for insert to authenticated
with check (
  church_id is not null
  and created_by = auth.uid()
  and public.has_church_feature_permission(auth.uid(), church_id, 'events', 'create')
);

drop policy if exists "Church managers can update events" on public.events;
create policy "Church managers can update events"
on public.events for update to authenticated
using (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'events', 'edit')
  and (
    created_by = auth.uid()
    or public.has_church_feature_permission(auth.uid(), church_id, 'events', 'manage')
  )
)
with check (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'events', 'edit')
  and (
    created_by = auth.uid()
    or public.has_church_feature_permission(auth.uid(), church_id, 'events', 'manage')
  )
);

create or replace function public.enforce_event_mutation_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_church_id uuid := new.church_id;
begin
  if session_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
    return new;
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is distinct from auth.uid() then
      raise exception 'Event creator must match the authenticated actor' using errcode = '42501';
    end if;
    if not public.has_church_feature_permission(auth.uid(), v_church_id, 'events', 'create') then
      raise exception 'Missing create permission for events' using errcode = '42501';
    end if;
  else
    if not public.has_church_feature_permission(auth.uid(), v_church_id, 'events', 'edit') then
      raise exception 'Missing edit permission for events' using errcode = '42501';
    end if;
    if old.created_by is distinct from auth.uid()
       and not public.has_church_feature_permission(auth.uid(), old.church_id, 'events', 'manage') then
      raise exception 'Missing manage permission for cross-owner Event update' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_event_mutation_scope() from public, anon, authenticated;
drop trigger if exists enforce_event_mutation_scope on public.events;
create trigger enforce_event_mutation_scope
before insert or update on public.events
for each row execute function public.enforce_event_mutation_scope();
