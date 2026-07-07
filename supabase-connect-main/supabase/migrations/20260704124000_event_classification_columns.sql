-- Add optional event classification columns consumed by the Parish Calendar Engine.
-- These are nullable/additive so legacy event rows remain valid and editable.

alter table public.events
  add column if not exists event_type text,
  add column if not exists ministry text,
  add column if not exists visibility text not null default 'public';

alter table public.events
  drop constraint if exists events_visibility_check,
  add constraint events_visibility_check
    check (visibility in ('public', 'member', 'pastoral', 'admin', 'finance'));

create index if not exists idx_events_church_event_type
  on public.events (church_id, event_type);

create index if not exists idx_events_church_visibility
  on public.events (church_id, visibility);
