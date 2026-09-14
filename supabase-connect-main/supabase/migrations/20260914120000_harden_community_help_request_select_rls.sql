-- Wave 16 Slice 2: harden Community Help request visibility.
--
-- The legacy SELECT policies below were permissive and therefore ORed together,
-- allowing any same-church authenticated member to read every help request,
-- including another member's pending/rejected request. Keep the intended member
-- product contract: owners can read their own requests, church members can read
-- approved requests, and authorized church managers can review all requests.

drop policy if exists "Church members can view help requests" on public.community_help_requests;
drop policy if exists "help requests same church" on public.community_help_requests;

drop policy if exists "Members can read own help requests" on public.community_help_requests;
drop policy if exists "Members can read approved help requests" on public.community_help_requests;
drop policy if exists "Church managers can read help requests" on public.community_help_requests;

create policy "Members can read own help requests"
on public.community_help_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = community_help_requests.member_id
      and m.church_id = community_help_requests.church_id
      and m.user_id = auth.uid()
  )
);

create policy "Members can read approved help requests"
on public.community_help_requests
for select
to authenticated
using (
  status = 'approved'
  and exists (
    select 1
    from public.members m
    where m.church_id = community_help_requests.church_id
      and m.user_id = auth.uid()
  )
);

create policy "Church managers can read help requests"
on public.community_help_requests
for select
to authenticated
using (
  church_id is not null
  and (
    public.can_manage_church_roles(auth.uid(), church_id)
    or public.can_manage_church_workspace(auth.uid(), church_id)
  )
);
