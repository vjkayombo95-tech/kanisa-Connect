drop policy if exists "Authenticated users can read published CMS daily readings"
on public.content_daily_readings;

create policy "Authenticated users can read member-visible CMS daily readings"
on public.content_daily_readings
for select
to authenticated
using (
  status in ('published', 'featured')
  and visibility in ('public', 'member')
);
