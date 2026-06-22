-- Church administrators must be able to read the payment instructions shown during upgrade submission.
alter table public.platform_settings enable row level security;

drop policy if exists "Authenticated users can view platform billing settings" on public.platform_settings;
create policy "Authenticated users can view platform billing settings"
on public.platform_settings
for select
to authenticated
using (true);
