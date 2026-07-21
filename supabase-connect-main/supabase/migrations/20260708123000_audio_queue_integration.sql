-- Queue integration layer for Audio CMS. Keeps existing records compatible while
-- adding production processing states and job logs.

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'audio_jobs'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%status%';

  if constraint_name is not null then
    execute format('alter table public.audio_jobs drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.audio_jobs
add constraint audio_jobs_status_check
check (
  status in (
    'draft', 'queued', 'processing', 'needs_review', 'completed', 'published', 'failed', 'cancelled',
    'QUEUED', 'VALIDATING', 'TRANSCRIBING', 'ALIGNING', 'BUILDING_INDEX', 'VALIDATING_INDEX',
    'COMPLETED', 'FAILED', 'REVIEW_REQUIRED', 'CANCELLED'
  )
);

create table if not exists public.audio_job_logs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  job_id uuid not null references public.audio_jobs(id) on delete cascade,
  level text not null default 'info' check (level in ('debug', 'info', 'warning', 'error')),
  stage text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audio_job_logs_job_created_at
on public.audio_job_logs (job_id, created_at desc);

alter table public.audio_job_logs enable row level security;

drop policy if exists "Church admins can read audio job logs" on public.audio_job_logs;
create policy "Church admins can read audio job logs"
on public.audio_job_logs for select to authenticated
using (public.can_view_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio job logs" on public.audio_job_logs;
create policy "Church admins can manage audio job logs"
on public.audio_job_logs for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

grant select, insert, update, delete on public.audio_job_logs to authenticated;

create or replace function public.log_audio_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_type public.notification_type := 'info';
  notification_title text;
  notification_message text;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.processing_stage is distinct from old.processing_stage then
    insert into public.audio_job_logs (church_id, job_id, level, stage, message, metadata)
    values (
      new.church_id,
      new.id,
      case when new.status in ('FAILED', 'failed') then 'error' else 'info' end,
      coalesce(new.processing_stage, new.status),
      'Audio job moved to ' || new.status,
      jsonb_build_object('status', new.status, 'progress', new.progress)
    );
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('COMPLETED', 'FAILED', 'REVIEW_REQUIRED', 'completed', 'failed', 'needs_review') then
    notification_type := case
      when new.status in ('FAILED', 'failed') then 'error'::public.notification_type
      when new.status in ('REVIEW_REQUIRED', 'needs_review') then 'warning'::public.notification_type
      else 'success'::public.notification_type
    end;

    notification_title := case
      when new.status in ('FAILED', 'failed') then 'Audio processing failed'
      when new.status in ('REVIEW_REQUIRED', 'needs_review') then 'Audio needs review'
      else 'Audio processing complete'
    end;

    notification_message := new.book || ' ' || new.chapter || ' is ' || lower(replace(new.status, '_', ' ')) || '.';

    insert into public.notifications (church_id, user_id, title, message, type)
    values (new.church_id, new.created_by, notification_title, notification_message, notification_type);
  end if;

  return new;
end;
$$;

drop trigger if exists audio_job_status_change_log on public.audio_jobs;
create trigger audio_job_status_change_log
after insert or update of status, processing_stage, progress on public.audio_jobs
for each row execute function public.log_audio_job_status_change();
