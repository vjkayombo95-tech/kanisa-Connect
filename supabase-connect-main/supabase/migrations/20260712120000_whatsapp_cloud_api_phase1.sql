-- WhatsApp Cloud API Phase 1. Additive only; secrets intentionally remain outside the database.
alter table public.churches
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists whatsapp_mass_intentions_enabled boolean not null default false,
  add column if not exists mass_intention_auto_confirm_paid boolean not null default false,
  add column if not exists mass_intention_default_fee numeric,
  add column if not exists mass_intention_currency text not null default 'TZS',
  add column if not exists mass_intention_slot_capacity integer,
  add column if not exists mass_intention_require_manual_review boolean not null default true,
  add column if not exists whatsapp_service_window_hours integer not null default 24;

alter table public.churches drop constraint if exists churches_whatsapp_settings_check;
alter table public.churches add constraint churches_whatsapp_settings_check check (
  (mass_intention_default_fee is null or mass_intention_default_fee >= 0) and
  (mass_intention_slot_capacity is null or mass_intention_slot_capacity > 0) and
  whatsapp_service_window_hours between 1 and 72 and mass_intention_currency ~ '^[A-Z]{3}$'
);

create table if not exists public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id) on delete cascade,
  phone_number_id text not null, business_account_id text not null, display_phone_number text, status text not null default 'disabled',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint whatsapp_accounts_status_check check (status in ('disabled','test','active','suspended')),
  unique (phone_number_id), unique (church_id, business_account_id, phone_number_id)
);

-- Staging may already contain the account mapping table from pre-baseline setup.
-- Preserve all rows, repair only additive/default metadata, and fail closed when
-- tenant ownership, provider identifiers, or column types are incompatible.
alter table public.whatsapp_accounts
  add column if not exists display_phone_number text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  v_column record;
  v_name text;
  v_expected_types jsonb := jsonb_build_object(
    'id', 'uuid',
    'church_id', 'uuid',
    'phone_number_id', 'text',
    'business_account_id', 'text',
    'display_phone_number', 'text',
    'status', 'text',
    'created_at', 'timestamp with time zone',
    'updated_at', 'timestamp with time zone'
  );
begin
  foreach v_name in array array['id','church_id','phone_number_id','business_account_id','display_phone_number','status','created_at','updated_at'] loop
    select c.data_type into v_column
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'whatsapp_accounts' and c.column_name = v_name;
    if not found then
      raise exception 'public.whatsapp_accounts is incompatible: required column % is missing', v_name;
    end if;
    if v_column.data_type is distinct from v_expected_types ->> v_name then
      raise exception 'public.whatsapp_accounts.% is incompatible: expected %, found %',
        v_name, v_expected_types ->> v_name, v_column.data_type;
    end if;
  end loop;

  if exists (
    select 1 from public.whatsapp_accounts
    where id is null or church_id is null or phone_number_id is null or business_account_id is null
       or status is null or created_at is null or updated_at is null
  ) then
    raise exception 'public.whatsapp_accounts contains nulls in required columns';
  end if;
  if exists (select 1 from public.whatsapp_accounts where status not in ('disabled','test','active','suspended')) then
    raise exception 'public.whatsapp_accounts contains unsupported status values';
  end if;
end
$$;

alter table public.whatsapp_accounts
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column church_id drop default,
  alter column church_id set not null,
  alter column phone_number_id drop default,
  alter column phone_number_id set not null,
  alter column business_account_id drop default,
  alter column business_account_id set not null,
  alter column display_phone_number drop default,
  alter column status set default 'disabled',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.whatsapp_accounts drop constraint if exists whatsapp_accounts_status_check;
alter table public.whatsapp_accounts add constraint whatsapp_accounts_status_check
  check (status in ('disabled','test','active','suspended'));

do $$
declare
  v_id smallint;
  v_church smallint;
  v_church_target smallint;
  v_phone smallint;
  v_business smallint;
begin
  select attnum into v_id from pg_attribute where attrelid = 'public.whatsapp_accounts'::regclass and attname = 'id' and not attisdropped;
  select attnum into v_church from pg_attribute where attrelid = 'public.whatsapp_accounts'::regclass and attname = 'church_id' and not attisdropped;
  select attnum into v_church_target from pg_attribute where attrelid = 'public.churches'::regclass and attname = 'id' and not attisdropped;
  select attnum into v_phone from pg_attribute where attrelid = 'public.whatsapp_accounts'::regclass and attname = 'phone_number_id' and not attisdropped;
  select attnum into v_business from pg_attribute where attrelid = 'public.whatsapp_accounts'::regclass and attname = 'business_account_id' and not attisdropped;

  if not exists (select 1 from pg_constraint where conrelid = 'public.whatsapp_accounts'::regclass and contype = 'p' and conkey = array[v_id]::smallint[]) then
    if exists (select 1 from pg_constraint where conrelid = 'public.whatsapp_accounts'::regclass and contype = 'p') then
      raise exception 'public.whatsapp_accounts has an incompatible primary key';
    end if;
    alter table public.whatsapp_accounts add constraint whatsapp_accounts_pkey primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.whatsapp_accounts'::regclass and contype = 'f'
      and conkey = array[v_church]::smallint[] and confrelid = 'public.churches'::regclass
      and confkey = array[v_church_target]::smallint[] and confdeltype = 'c'
  ) then
    alter table public.whatsapp_accounts add constraint whatsapp_accounts_church_id_fkey
      foreign key (church_id) references public.churches(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.whatsapp_accounts'::regclass and contype = 'u' and conkey = array[v_phone]::smallint[]) then
    alter table public.whatsapp_accounts add constraint whatsapp_accounts_phone_number_id_key unique (phone_number_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.whatsapp_accounts'::regclass and contype = 'u'
      and conkey = array[v_church,v_business,v_phone]::smallint[]
  ) then
    alter table public.whatsapp_accounts add constraint whatsapp_accounts_tenant_provider_key
      unique (church_id, business_account_id, phone_number_id);
  end if;
end
$$;

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null, wa_id text not null, normalized_phone text not null, profile_name text,
  verification_status text not null default 'unverified', linked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint whatsapp_contacts_verification_check check (verification_status in ('unverified','pending','verified','revoked')),
  unique (church_id, wa_id), unique (id, church_id)
);
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id) on delete cascade,
  contact_id uuid not null, service_window_opened_at timestamptz, service_window_expires_at timestamptz,
  current_state text not null default 'IDLE', context jsonb not null default '{}'::jsonb, last_inbound_at timestamptz, last_outbound_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint whatsapp_conversation_contact_fk foreign key (contact_id, church_id) references public.whatsapp_contacts(id, church_id) on delete cascade,
  constraint whatsapp_conversations_state_check check (current_state in ('IDLE','SELECT_INTENTION_TYPE','ENTER_INTENTION_DETAILS','SELECT_DATE','SELECT_MASS_TIME','CONFIRM_SUMMARY','AWAITING_PAYMENT','COMPLETED','CANCELLED')),
  unique (id, church_id)
);
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id) on delete cascade,
  conversation_id uuid not null, contact_id uuid not null, provider_message_id text unique, direction text not null, message_type text not null,
  message_category text, status text not null default 'received', body text, payload jsonb not null default '{}'::jsonb,
  estimated_cost_usd numeric, created_at timestamptz not null default now(), delivered_at timestamptz, read_at timestamptz, failed_at timestamptz, failure_reason text,
  constraint whatsapp_message_conversation_fk foreign key (conversation_id, church_id) references public.whatsapp_conversations(id, church_id) on delete cascade,
  constraint whatsapp_message_contact_fk foreign key (contact_id, church_id) references public.whatsapp_contacts(id, church_id) on delete cascade,
  constraint whatsapp_messages_direction_check check (direction in ('inbound','outbound')),
  constraint whatsapp_messages_status_check check (status in ('queued','dry_run','sent','received','delivered','read','failed')),
  constraint whatsapp_messages_category_check check (message_category is null or message_category in ('service','utility','marketing','authentication'))
);
create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(), church_id uuid references public.churches(id) on delete cascade,
  provider_event_key text not null unique, event_type text not null, payload jsonb not null, processing_status text not null default 'received',
  processing_error text, received_at timestamptz not null default now(), processed_at timestamptz,
  constraint whatsapp_events_status_check check (processing_status in ('received','processing','processed','ignored','failed'))
);
create table if not exists public.whatsapp_session_states (
  conversation_id uuid primary key, church_id uuid not null references public.churches(id) on delete cascade, flow_name text not null default 'NIA_YA_MISA',
  state text not null, collected_data jsonb not null default '{}'::jsonb, expires_at timestamptz not null, updated_at timestamptz not null default now(),
  constraint whatsapp_session_conversation_fk foreign key (conversation_id, church_id) references public.whatsapp_conversations(id, church_id) on delete cascade,
  constraint whatsapp_session_state_check check (state in ('IDLE','SELECT_INTENTION_TYPE','ENTER_INTENTION_DETAILS','SELECT_DATE','SELECT_MASS_TIME','CONFIRM_SUMMARY','AWAITING_PAYMENT','COMPLETED','CANCELLED'))
);
create table if not exists public.whatsapp_usage_daily (
  church_id uuid not null references public.churches(id) on delete cascade, usage_date date not null,
  inbound_count integer not null default 0, service_reply_count integer not null default 0, utility_count integer not null default 0,
  marketing_count integer not null default 0, authentication_count integer not null default 0, estimated_cost_usd numeric not null default 0,
  primary key (church_id, usage_date), constraint whatsapp_usage_nonnegative_check check (least(inbound_count,service_reply_count,utility_count,marketing_count,authentication_count) >= 0 and estimated_cost_usd >= 0)
);

-- Project has no canonical Mass schedule table, so Phase 1 adds tenant-owned slots.
create table if not exists public.whatsapp_mass_slots (
  id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id) on delete cascade,
  mass_date date not null, mass_time time not null, label text not null, capacity integer not null, reserved_count integer not null default 0,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (church_id, mass_date, mass_time), constraint whatsapp_mass_slots_capacity_check check (capacity > 0 and reserved_count between 0 and capacity), unique(id, church_id)
);
alter table public.mass_intentions add column if not exists whatsapp_conversation_id uuid references public.whatsapp_conversations(id) on delete set null;
alter table public.mass_intentions add column if not exists whatsapp_mass_slot_id uuid references public.whatsapp_mass_slots(id) on delete set null;
alter table public.mass_intentions add column if not exists payment_reference text;
alter table public.mass_intentions add column if not exists review_reason text;

create table if not exists public.whatsapp_payment_attempts (
  id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id) on delete cascade,
  mass_intention_id uuid not null references public.mass_intentions(id) on delete cascade, provider text not null, provider_reference text,
  secure_token_hash text not null, amount numeric not null, currency text not null, status text not null default 'pending', callback_event_key text unique,
  created_at timestamptz not null default now(), verified_at timestamptz, updated_at timestamptz not null default now(),
  unique(provider, provider_reference), constraint whatsapp_payment_status_check check(status in ('pending','verified','failed','duplicate','manual_review')), constraint whatsapp_payment_amount_check check(amount >= 0)
);
create table if not exists public.whatsapp_mass_intention_audit (
  id bigint generated always as identity primary key, church_id uuid not null references public.churches(id) on delete cascade,
  mass_intention_id uuid not null references public.mass_intentions(id) on delete cascade, event_type text not null, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_contacts_church_phone on public.whatsapp_contacts(church_id, normalized_phone);
create index if not exists idx_whatsapp_conversations_church_contact_updated on public.whatsapp_conversations(church_id, contact_id, updated_at desc);
create index if not exists idx_whatsapp_messages_church_conversation_created on public.whatsapp_messages(church_id, conversation_id, created_at desc);
create index if not exists idx_whatsapp_webhook_events_church_received on public.whatsapp_webhook_events(church_id, received_at desc);
create index if not exists idx_whatsapp_session_states_church_expires on public.whatsapp_session_states(church_id, expires_at);
create index if not exists idx_whatsapp_mass_slots_church_date_active on public.whatsapp_mass_slots(church_id, mass_date) where active;
create index if not exists idx_whatsapp_payment_attempts_church_intention on public.whatsapp_payment_attempts(church_id, mass_intention_id);
create index if not exists idx_whatsapp_audit_church_intention_created on public.whatsapp_mass_intention_audit(church_id, mass_intention_id, created_at);

do $$ declare t text; begin foreach t in array array['whatsapp_accounts','whatsapp_contacts','whatsapp_conversations','whatsapp_messages','whatsapp_webhook_events','whatsapp_session_states','whatsapp_usage_daily','whatsapp_mass_slots','whatsapp_payment_attempts','whatsapp_mass_intention_audit'] loop execute format('alter table public.%I enable row level security', t); execute format('drop policy if exists %I on public.%I', 'Workspace managers read ' || t, t); execute format('create policy %I on public.%I for select to authenticated using (church_id is not null and public.can_manage_church_workspace(auth.uid(), church_id))', 'Workspace managers read ' || t, t); end loop; end $$;

-- No authenticated write policies: service-role functions own processing. Keep service grants explicit.
revoke all on public.whatsapp_accounts, public.whatsapp_contacts, public.whatsapp_conversations, public.whatsapp_messages, public.whatsapp_webhook_events, public.whatsapp_session_states, public.whatsapp_usage_daily, public.whatsapp_mass_slots, public.whatsapp_payment_attempts, public.whatsapp_mass_intention_audit from anon, authenticated;
grant select on public.whatsapp_accounts, public.whatsapp_contacts, public.whatsapp_conversations, public.whatsapp_messages, public.whatsapp_webhook_events, public.whatsapp_session_states, public.whatsapp_usage_daily, public.whatsapp_mass_slots, public.whatsapp_payment_attempts, public.whatsapp_mass_intention_audit to authenticated;
grant all on public.whatsapp_accounts, public.whatsapp_contacts, public.whatsapp_conversations, public.whatsapp_messages, public.whatsapp_webhook_events, public.whatsapp_session_states, public.whatsapp_usage_daily, public.whatsapp_mass_slots, public.whatsapp_payment_attempts, public.whatsapp_mass_intention_audit to service_role;
do $$ begin if to_regclass('public.whatsapp_mass_intention_audit_id_seq') is not null then grant usage, select on sequence public.whatsapp_mass_intention_audit_id_seq to service_role; end if; end $$;

drop trigger if exists whatsapp_accounts_updated on public.whatsapp_accounts;
create trigger whatsapp_accounts_updated before update on public.whatsapp_accounts for each row execute function public.update_updated_at_column();
drop trigger if exists whatsapp_contacts_updated on public.whatsapp_contacts;
create trigger whatsapp_contacts_updated before update on public.whatsapp_contacts for each row execute function public.update_updated_at_column();
drop trigger if exists whatsapp_conversations_updated on public.whatsapp_conversations;
create trigger whatsapp_conversations_updated before update on public.whatsapp_conversations for each row execute function public.update_updated_at_column();
drop trigger if exists whatsapp_mass_slots_updated on public.whatsapp_mass_slots;
create trigger whatsapp_mass_slots_updated before update on public.whatsapp_mass_slots for each row execute function public.update_updated_at_column();
drop trigger if exists whatsapp_payment_attempts_updated on public.whatsapp_payment_attempts;
create trigger whatsapp_payment_attempts_updated before update on public.whatsapp_payment_attempts for each row execute function public.update_updated_at_column();
