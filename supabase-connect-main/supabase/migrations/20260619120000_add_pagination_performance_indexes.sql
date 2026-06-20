-- Performance indexes for paginated church admin list pages.
-- Checked against generated Supabase types before adding.

create index if not exists idx_members_church_id on public.members(church_id);
create index if not exists idx_members_church_created_at on public.members(church_id, created_at desc);
create index if not exists idx_members_phone on public.members(phone);
create index if not exists idx_members_email on public.members(email);

-- public.contributions uses "date" and "created_at"; it does not have "contribution_date".
create index if not exists idx_contributions_church_member_created_at on public.contributions(church_id, member_id, created_at desc);
create index if not exists idx_contributions_church_created_at on public.contributions(church_id, created_at desc);
create index if not exists idx_contributions_member_id on public.contributions(member_id);

-- Attendance records live in public.event_attendances.
create index if not exists idx_event_attendances_church_created_at on public.event_attendances(church_id, created_at desc);
create index if not exists idx_event_attendances_event_id on public.event_attendances(event_id);
create index if not exists idx_event_attendances_member_id on public.event_attendances(member_id);

-- Groups/Jumuiya are stored as public.communities and public.member_communities.
create index if not exists idx_communities_church_id on public.communities(church_id);
create index if not exists idx_member_communities_community_id on public.member_communities(community_id);
create index if not exists idx_member_communities_member_id on public.member_communities(member_id);

-- Billing payments are stored as public.subscription_payments.
create index if not exists idx_subscription_payments_church_status_created_at on public.subscription_payments(church_id, status, created_at desc);

create index if not exists idx_pledge_payments_member_id on public.pledge_payments(member_id);
create index if not exists idx_pledge_payments_pledge_id on public.pledge_payments(pledge_id);
create index if not exists idx_pledges_church_status_date on public.pledges(church_id, status, created_at desc);
create index if not exists idx_pledges_member_id on public.pledges(member_id);

create index if not exists idx_mass_intentions_church_date on public.mass_intentions(church_id, created_at desc);
create index if not exists idx_prayer_requests_church_date on public.prayer_requests(church_id, created_at desc);
