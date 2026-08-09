-- Allow church managers to see the events they are allowed to maintain.
-- The existing same-church member SELECT policy remains in place for member
-- calendar access; this policy covers admins/owners who may not have a linked
-- members row.

drop policy if exists "Church managers can select events" on public.events;
create policy "Church managers can select events"
on public.events
for select
to authenticated
using (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
);

