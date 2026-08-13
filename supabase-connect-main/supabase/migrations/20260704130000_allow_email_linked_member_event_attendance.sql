-- Let signed-in members RSVP when their member row is linked by email but
-- does not yet have user_id populated. Existing user_id-based policies remain.

drop policy if exists "Email linked members can view own event attendances" on public.event_attendances;
create policy "Email linked members can view own event attendances"
on public.event_attendances
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = event_attendances.member_id
      and m.church_id = event_attendances.church_id
      and lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "Email linked members can create own event attendances" on public.event_attendances;
create policy "Email linked members can create own event attendances"
on public.event_attendances
for insert
to authenticated
with check (
  exists (
    select 1
    from public.members m
    where m.id = event_attendances.member_id
      and m.church_id = event_attendances.church_id
      and lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "Email linked members can update own event attendances" on public.event_attendances;
create policy "Email linked members can update own event attendances"
on public.event_attendances
for update
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = event_attendances.member_id
      and m.church_id = event_attendances.church_id
      and lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.id = event_attendances.member_id
      and m.church_id = event_attendances.church_id
      and lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

