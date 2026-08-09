-- Ensure Super Admin feature management has a default catalog and current RLS.
-- This is forward-only so environments that already ran the first feature
-- controls migration still converge without manual database edits.

alter table public.church_features
  add column if not exists locked boolean not null default false;

drop policy if exists "super admin manage features" on public.platform_features;
drop policy if exists "Authenticated users can read platform features" on public.platform_features;
drop policy if exists "Super admins manage platform features" on public.platform_features;

create policy "Authenticated users can read platform features"
on public.platform_features
for select
to authenticated
using (true);

create policy "Super admins manage platform features"
on public.platform_features
for all
to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "admin manage church features" on public.church_features;
drop policy if exists "Super admins manage church features" on public.church_features;

create policy "Super admins manage church features"
on public.church_features
for all
to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

insert into public.platform_features (key, name, description, globally_enabled, globally_locked)
values
  ('members', 'Members', 'Member directory and member administration.', true, false),
  ('contributions', 'Contributions', 'Contribution records, receipts, and giving administration.', true, false),
  ('give', 'Giving', 'Member giving and payment entry points.', true, false),
  ('pledges', 'Pledges', 'Pledge creation, tracking, and fulfilment.', true, false),
  ('communities', 'Communities', 'Small Christian communities and groups.', true, false),
  ('ministries', 'Ministries', 'Ministry teams, requests, and leadership.', true, false),
  ('families', 'Families', 'Family grouping and household records.', true, false),
  ('events', 'Events & Calendar', 'Parish events, calendar, and Mass schedule surfaces.', true, false),
  ('event_requests', 'Event Requests', 'Member event request submission and review.', true, false),
  ('announcements', 'Announcements', 'Parish announcement publishing and viewing.', true, false),
  ('sermons', 'Sermons', 'Sermon and homily content.', true, false),
  ('bible_verses', 'Bible', 'Bible reading and scripture surfaces.', true, false),
  ('prayer_requests', 'Prayer Requests', 'Prayer request submission, review, and tracking.', true, false),
  ('mass_intentions', 'Mass Intentions', 'Mass intention requests and scheduling.', true, false),
  ('sacraments', 'Sacraments', 'Sacramental records and pastoral sacrament workflows.', true, false),
  ('community_help', 'Community Help', 'Assistance requests and community support.', true, false),
  ('reports', 'Reports', 'Operational and financial reports.', true, false),
  ('channels', 'Channels', 'Community and parish communication channels.', true, false),
  ('notifications', 'Notifications', 'Notification inbox and messaging surfaces.', true, false),
  ('roles', 'Invitations & Roles', 'Role assignment and parish invitations.', true, false),
  ('finance_intelligence', 'Finance Intelligence', 'Finance intelligence, trends, and insights.', true, false),
  ('kanisa_ai', 'Kanisa AI', 'Kanisa AI command center and assistant surfaces.', true, false),
  ('catholic_content', 'Catholic Content', 'Saints, daily readings, liturgical calendar, and prayer library.', true, false)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();
