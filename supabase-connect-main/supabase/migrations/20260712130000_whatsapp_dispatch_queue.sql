-- Trusted WhatsApp dispatcher queue controls. Additive and forward-only.
alter table public.churches
  add column if not exists whatsapp_daily_message_limit integer not null default 250;
alter table public.churches drop constraint if exists churches_whatsapp_daily_limit_check;
alter table public.churches add constraint churches_whatsapp_daily_limit_check
  check (whatsapp_daily_message_limit between 1 and 10000);

alter table public.whatsapp_messages
  add column if not exists dispatch_status text not null default 'not_applicable',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists failure_category text,
  add column if not exists requires_template boolean not null default false;

alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_dispatch_status_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_dispatch_status_check check (
  dispatch_status in ('not_applicable','queued','sending','retry_scheduled','sent','dry_run_completed','requires_template','permanent_failed','max_attempts')
);
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_attempt_count_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_attempt_count_check check (attempt_count between 0 and 10);
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_failure_category_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_failure_category_check check (
  failure_category is null or failure_category in ('retryable_provider','provider_auth','invalid_recipient','invalid_payload','template_rejected','service_window_closed','church_disabled','account_missing','tenant_mismatch','daily_limit','worker_failure','max_attempts')
);

update public.whatsapp_messages
set dispatch_status = 'queued'
where direction = 'outbound' and status = 'queued' and dispatch_status = 'not_applicable';

create index if not exists whatsapp_messages_dispatch_eligible_idx
  on public.whatsapp_messages (next_attempt_at, created_at)
  where direction = 'outbound' and dispatch_status in ('queued','retry_scheduled');
create index if not exists whatsapp_messages_stale_claim_idx
  on public.whatsapp_messages (claimed_at)
  where dispatch_status = 'sending';

create or replace function public.claim_whatsapp_messages(
  _worker_id text,
  _batch_size integer default 10,
  _max_attempts integer default 5,
  _stale_after interval default interval '10 minutes',
  _message_id uuid default null
)
returns table(
  message_id uuid, church_id uuid, conversation_id uuid, contact_id uuid,
  message_type text, message_category text, body text, payload jsonb,
  attempt_count integer, service_window_expires_at timestamptz,
  normalized_phone text, phone_number_id text, account_status text,
  whatsapp_enabled boolean, whatsapp_mass_intentions_enabled boolean,
  whatsapp_daily_message_limit integer, sent_today bigint
)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_limit integer := least(greatest(coalesce(_batch_size, 10), 1), 25);
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if nullif(trim(coalesce(_worker_id, '')), '') is null then raise exception 'worker id required'; end if;
  if _max_attempts not between 1 and 10 then raise exception 'invalid maximum attempts'; end if;

  -- Serialize short claim transactions so per-church daily limits cannot be over-claimed.
  perform pg_advisory_xact_lock(hashtext('whatsapp_dispatch_claim'));
  update public.whatsapp_messages m set dispatch_status = 'retry_scheduled', status = 'queued', claimed_at = null, claimed_by = null,
    next_attempt_at = now(), failure_category = 'worker_failure', failure_reason = 'Stale dispatcher claim recovered'
  where m.dispatch_status = 'sending' and m.claimed_at < now() - _stale_after and m.attempt_count < _max_attempts;
  update public.whatsapp_messages m set dispatch_status = 'max_attempts', status = 'failed', failed_at = coalesce(failed_at, now()),
    failure_category = 'max_attempts', failure_reason = 'Maximum dispatch attempts reached', claimed_at = null, claimed_by = null
  where m.dispatch_status in ('queued','retry_scheduled','sending') and m.attempt_count >= _max_attempts;

  return query
  with candidates as (
    select m.id
    from public.whatsapp_messages m
    where m.direction = 'outbound' and m.dispatch_status in ('queued','retry_scheduled')
      and (_message_id is null or m.id = _message_id)
      and m.attempt_count < _max_attempts and coalesce(m.next_attempt_at, m.created_at) <= now()
    order by coalesce(m.next_attempt_at, m.created_at), m.created_at
    for update skip locked limit v_limit
  ), claimed as (
    update public.whatsapp_messages m set dispatch_status = 'sending', status = 'queued', claimed_at = now(), claimed_by = trim(_worker_id),
      last_attempt_at = now(), attempt_count = m.attempt_count + 1
    from candidates c where m.id = c.id returning m.*
  )
  select c.id, c.church_id, c.conversation_id, c.contact_id, c.message_type, c.message_category, c.body, c.payload,
    c.attempt_count, conv.service_window_expires_at, ct.normalized_phone, wa.phone_number_id, wa.status,
    ch.whatsapp_enabled, ch.whatsapp_mass_intentions_enabled, ch.whatsapp_daily_message_limit,
    (select count(*) from public.whatsapp_messages sent where sent.church_id = c.church_id and sent.direction = 'outbound'
      and sent.dispatch_status in ('sent','dry_run_completed','sending') and sent.created_at >= current_date)::bigint
  from claimed c
  left join public.whatsapp_conversations conv on conv.id = c.conversation_id and conv.church_id = c.church_id
  left join public.whatsapp_contacts ct on ct.id = c.contact_id and ct.church_id = c.church_id
  left join lateral (select a.phone_number_id, a.status from public.whatsapp_accounts a where a.church_id = c.church_id and a.status in ('test','active') order by a.created_at limit 1) wa on true
  left join public.churches ch on ch.id = c.church_id;
end $$;

create or replace function public.complete_whatsapp_dispatch(
  _message_id uuid, _worker_id text, _outcome text, _provider_message_id text default null,
  _failure_category text default null, _failure_reason text default null, _next_attempt_at timestamptz default null
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_updated integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if _outcome not in ('sent','dry_run_completed','retry_scheduled','requires_template','permanent_failed','max_attempts') then raise exception 'invalid dispatch outcome'; end if;
  update public.whatsapp_messages set
    dispatch_status = _outcome,
    status = case when _outcome = 'sent' then 'sent' when _outcome = 'dry_run_completed' then 'dry_run' when _outcome = 'retry_scheduled' then 'queued' else 'failed' end,
    provider_message_id = coalesce(_provider_message_id, provider_message_id),
    next_attempt_at = case when _outcome = 'retry_scheduled' then _next_attempt_at else null end,
    requires_template = (_outcome = 'requires_template'), failure_category = _failure_category,
    failure_reason = left(nullif(_failure_reason, ''), 500), failed_at = case when _outcome in ('permanent_failed','max_attempts') then now() else failed_at end,
    claimed_at = null, claimed_by = null
  where id = _message_id and dispatch_status = 'sending' and claimed_by = trim(_worker_id);
  get diagnostics v_updated = row_count; return v_updated = 1;
end $$;

revoke all on function public.claim_whatsapp_messages(text, integer, integer, interval, uuid) from public, anon, authenticated;
revoke all on function public.complete_whatsapp_dispatch(uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_messages(text, integer, integer, interval, uuid) to service_role;
grant execute on function public.complete_whatsapp_dispatch(uuid, text, text, text, text, text, timestamptz) to service_role;

create or replace function public.whatsapp_dispatch_schema_diagnostics()
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'tables_present', (select count(*) = 7 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any(array['whatsapp_accounts','whatsapp_contacts','whatsapp_conversations','whatsapp_messages','whatsapp_webhook_events','whatsapp_session_states','whatsapp_usage_daily'])),
    'rls_enabled', (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'whatsapp_%' and c.relkind = 'r'),
    'claim_rpc_present', to_regprocedure('public.claim_whatsapp_messages(text,integer,integer,interval,uuid)') is not null,
    'complete_rpc_present', to_regprocedure('public.complete_whatsapp_dispatch(uuid,text,text,text,text,text,timestamptz)') is not null,
    'dispatch_constraint_present', exists(select 1 from pg_constraint where conname = 'whatsapp_messages_dispatch_status_check'),
    'tenant_constraints_present', exists(select 1 from pg_constraint where conname = 'whatsapp_message_conversation_fk') and exists(select 1 from pg_constraint where conname = 'whatsapp_message_contact_fk')
  )
$$;
revoke all on function public.whatsapp_dispatch_schema_diagnostics() from public, anon, authenticated;
grant execute on function public.whatsapp_dispatch_schema_diagnostics() to service_role;
