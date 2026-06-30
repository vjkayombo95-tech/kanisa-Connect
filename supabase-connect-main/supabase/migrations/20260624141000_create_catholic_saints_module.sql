-- V1.2 Foundation: Catholic Content Platform Phase 1 - Saints module.

create table if not exists public.saints (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  title text,
  feast_month integer not null check (feast_month between 1 and 12),
  feast_day integer not null check (feast_day between 1 and 31),
  patron_of text,
  birth_year integer,
  death_year integer,
  country text,
  biography_short text not null,
  biography_long text not null,
  quote text,
  reflection text not null,
  prayer text not null,
  image_url text,
  color_theme text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saint_translations (
  id uuid primary key default gen_random_uuid(),
  saint_id uuid not null references public.saints(id) on delete cascade,
  language_code text not null,
  translated_name text not null,
  biography_short text not null,
  biography_long text not null,
  reflection text not null,
  prayer text not null,
  quote text,
  created_at timestamptz not null default now(),
  unique (saint_id, language_code)
);

create index if not exists saints_feast_day_idx
on public.saints (feast_month, feast_day);

create index if not exists saints_is_active_idx
on public.saints (is_active);

create index if not exists saints_name_idx
on public.saints (name);

create index if not exists saint_translations_language_idx
on public.saint_translations (language_code);

drop trigger if exists update_saints_updated_at on public.saints;
create trigger update_saints_updated_at
before update on public.saints
for each row
execute function public.update_updated_at_column();

insert into storage.buckets (id, name, public)
values ('catholic-content', 'catholic-content', true)
on conflict (id) do update
set public = excluded.public;

alter table public.saints enable row level security;
alter table public.saint_translations enable row level security;

drop policy if exists "Authenticated users can read active saints"
on public.saints;
create policy "Authenticated users can read active saints"
on public.saints
for select
to authenticated
using (is_active = true or public.is_super_admin());

drop policy if exists "Super admins can insert saints"
on public.saints;
create policy "Super admins can insert saints"
on public.saints
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "Super admins can update saints"
on public.saints;
create policy "Super admins can update saints"
on public.saints
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Super admins can delete saints"
on public.saints;
create policy "Super admins can delete saints"
on public.saints
for delete
to authenticated
using (public.is_super_admin());

drop policy if exists "Authenticated users can read active saint translations"
on public.saint_translations;
create policy "Authenticated users can read active saint translations"
on public.saint_translations
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.saints s
    where s.id = saint_translations.saint_id
      and s.is_active = true
  )
);

drop policy if exists "Super admins can insert saint translations"
on public.saint_translations;
create policy "Super admins can insert saint translations"
on public.saint_translations
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "Super admins can update saint translations"
on public.saint_translations;
create policy "Super admins can update saint translations"
on public.saint_translations
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Super admins can delete saint translations"
on public.saint_translations;
create policy "Super admins can delete saint translations"
on public.saint_translations
for delete
to authenticated
using (public.is_super_admin());

grant select, insert, update, delete on public.saints to authenticated;
grant select, insert, update, delete on public.saint_translations to authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    drop policy if exists "Authenticated users can read catholic content assets" on storage.objects;
    drop policy if exists "Super admins can upload saint content assets" on storage.objects;
    drop policy if exists "Super admins can update saint content assets" on storage.objects;
    drop policy if exists "Super admins can delete saint content assets" on storage.objects;

    create policy "Authenticated users can read catholic content assets"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'catholic-content');

    create policy "Super admins can upload saint content assets"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'catholic-content'
      and name like 'saints/%'
      and public.is_super_admin()
    );

    create policy "Super admins can update saint content assets"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'catholic-content'
      and name like 'saints/%'
      and public.is_super_admin()
    )
    with check (
      bucket_id = 'catholic-content'
      and name like 'saints/%'
      and public.is_super_admin()
    );

    create policy "Super admins can delete saint content assets"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'catholic-content'
      and name like 'saints/%'
      and public.is_super_admin()
    );
  end if;
end $$;

create or replace function public.get_saint_of_the_day()
returns table (
  id uuid,
  slug text,
  name text,
  title text,
  feast_month integer,
  feast_day integer,
  patron_of text,
  birth_year integer,
  death_year integer,
  country text,
  biography_short text,
  biography_long text,
  quote text,
  reflection text,
  prayer text,
  image_url text,
  color_theme text
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.slug,
    s.name,
    s.title,
    s.feast_month,
    s.feast_day,
    s.patron_of,
    s.birth_year,
    s.death_year,
    s.country,
    s.biography_short,
    s.biography_long,
    s.quote,
    s.reflection,
    s.prayer,
    s.image_url,
    s.color_theme
  from public.saints s
  where s.is_active = true
    and s.feast_month = extract(month from current_date)::integer
    and s.feast_day = extract(day from current_date)::integer
  order by s.name asc;
$$;

grant execute on function public.get_saint_of_the_day() to authenticated;
