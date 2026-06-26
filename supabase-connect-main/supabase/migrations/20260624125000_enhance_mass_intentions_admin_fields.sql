-- Phase: Mass Intentions admin operations support.
-- Adds optional admin-facing fields without changing the existing member submission flow.

alter table public.mass_intentions
add column if not exists requested_by_name text,
add column if not exists requested_by_phone text,
add column if not exists offered_for_name text,
add column if not exists mass_date date,
add column if not exists mass_time text,
add column if not exists mass_name text,
add column if not exists amount numeric,
add column if not exists payment_status text not null default 'pending',
add column if not exists proof_image_url text,
add column if not exists updated_at timestamptz not null default now();

update public.mass_intentions
set amount = offering_amount
where amount is null
  and offering_amount is not null;

create index if not exists idx_mass_intentions_church_mass_date
on public.mass_intentions (church_id, mass_date);

create index if not exists idx_mass_intentions_payment_status
on public.mass_intentions (payment_status);

create index if not exists idx_mass_intentions_status
on public.mass_intentions (status);

drop trigger if exists set_mass_intentions_updated_at on public.mass_intentions;

create trigger set_mass_intentions_updated_at
before update on public.mass_intentions
for each row
execute function public.update_updated_at_column();

drop policy if exists "Workspace managers can read mass intentions" on public.mass_intentions;
create policy "Workspace managers can read mass intentions"
on public.mass_intentions
for select
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Workspace managers can create mass intentions" on public.mass_intentions;
create policy "Workspace managers can create mass intentions"
on public.mass_intentions
for insert
to authenticated
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Workspace managers can update mass intentions" on public.mass_intentions;
create policy "Workspace managers can update mass intentions"
on public.mass_intentions
for update
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can delete mass intentions" on public.mass_intentions;
create policy "Church admins can delete mass intentions"
on public.mass_intentions
for delete
to authenticated
using (
  public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = mass_intentions.church_id
      and lower(coalesce(ur.role, '')) in ('church_admin', 'admin')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.church_id = mass_intentions.church_id
      and lower(coalesce(p.role, '')) in ('church_admin', 'admin')
  )
  or exists (
    select 1
    from public.churches c
    where c.id = mass_intentions.church_id
      and (c.owner_id = auth.uid() or c.created_by = auth.uid())
  )
);
