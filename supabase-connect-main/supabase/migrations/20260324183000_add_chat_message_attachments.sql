alter table public.chat_messages
  alter column body drop not null;

alter table public.chat_messages
  add column if not exists attachment_name text,
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size bigint;
