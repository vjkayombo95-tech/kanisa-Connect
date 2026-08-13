-- Let signed-in members resolve their own member profile by email when the
-- member row has not yet been linked to auth.users via user_id.
-- This enables portal actions, including event RSVP, without exposing other
-- parish members.

drop policy if exists "Email linked members can view own member record" on public.members;
create policy "Email linked members can view own member record"
on public.members
for select
to authenticated
using (
  lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

