-- Security-audit hardening: restore tenant-scoped contribution access and keep
-- financial analytics visible only to workspace managers and platform admins.

drop policy if exists "Allow contributions select" on public.contributions;
drop policy if exists "Allow contributions update" on public.contributions;

-- The original manager policy did not include WITH CHECK.  Make a church_id
-- change impossible during an update, even for an otherwise-authorized manager.
drop policy if exists "Church admins can update contributions" on public.contributions;
create policy "Church admins can update contributions"
on public.contributions
for update
to authenticated
using (
  public.is_church_admin(auth.uid(), church_id)
  or public.is_super_admin(auth.uid())
)
with check (
  public.is_church_admin(auth.uid(), church_id)
  or public.is_super_admin(auth.uid())
);

drop policy if exists "Church members can read analytics snapshots" on public.analytics_snapshots;
create policy "Workspace managers can read analytics snapshots"
on public.analytics_snapshots
for select
to authenticated
using (
  public.is_church_admin(auth.uid(), church_id)
  or public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.churches c
    where c.id = analytics_snapshots.church_id
      and c.created_by = auth.uid()
  )
);
