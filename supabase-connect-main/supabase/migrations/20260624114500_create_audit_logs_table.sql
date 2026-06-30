-- Phase 4.3 SaaS Audit & Observability: audit logging foundation

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id uuid,
  description text,
  metadata jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs
add column if not exists actor_id uuid references auth.users(id) on delete set null;

alter table public.audit_logs
add column if not exists actor_role text;

alter table public.audit_logs
add column if not exists entity_type text;

alter table public.audit_logs
add column if not exists description text;

alter table public.audit_logs
add column if not exists metadata jsonb not null default '{}';

alter table public.audit_logs
add column if not exists ip_address text;

alter table public.audit_logs enable row level security;

create policy "Super admins can view audit logs"
on public.audit_logs
for select
to authenticated
using (public.is_super_admin());

grant select
on public.audit_logs
to authenticated;

create index if not exists audit_logs_created_at_idx
on public.audit_logs (created_at desc);

create index if not exists audit_logs_actor_id_idx
on public.audit_logs (actor_id);

create index if not exists audit_logs_entity_type_idx
on public.audit_logs (entity_type);

create index if not exists audit_logs_action_idx
on public.audit_logs (action);
