-- Disposable-database prerequisites for replaying the production migration history.
-- These objects are normally supplied by Supabase Auth and Storage services.

insert into auth.users (id, email, aud, role, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000055',
  'hauletino55@gmail.com',
  'authenticated',
  'authenticated',
  now(),
  now()
)
on conflict do nothing;

set role supabase_admin;

create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text not null,
  owner uuid,
  owner_id text
);

alter table storage.objects enable row level security;

grant all on storage.buckets, storage.objects to postgres;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)];
$$;

create or replace function storage.filename(name text)
returns text
language sql
immutable
as $$
  select reverse(split_part(reverse(name), '/', 1));
$$;

grant execute on function storage.foldername(text), storage.filename(text) to postgres;

reset role;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
