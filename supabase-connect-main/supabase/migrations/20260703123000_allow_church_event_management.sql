-- Allow church managers to create and maintain parish events.
-- SELECT remains governed by the existing same-church policy.

drop policy if exists "Church managers can insert events" on public.events;
create policy "Church managers can insert events"
on public.events
for insert
to authenticated
with check (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Church managers can update events" on public.events;
create policy "Church managers can update events"
on public.events
for update
to authenticated
using (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
)
with check (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
);

drop policy if exists "Church managers can delete events" on public.events;
create policy "Church managers can delete events"
on public.events
for delete
to authenticated
using (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
);
