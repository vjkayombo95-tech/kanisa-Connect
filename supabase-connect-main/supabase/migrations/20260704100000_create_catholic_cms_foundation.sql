-- Kanisa Connect v2.0: Catholic CMS foundation.
-- Shared content infrastructure for prayers, future devotions, novenas,
-- reflections, catechism, and Catholic documents.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.content_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  color text,
  parent_id uuid references public.content_categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.content_languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  native_name text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists content_languages_one_default
  on public.content_languages (is_default)
  where is_default;

create table if not exists public.content_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  cover_image text,
  featured boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'featured', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_prayers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  body text not null,
  category_id uuid references public.content_categories(id) on delete set null,
  language_id uuid references public.content_languages(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'featured', 'archived')),
  featured boolean not null default false,
  visibility text not null default 'member'
    check (visibility in ('public', 'member', 'pastoral', 'admin')),
  author text,
  source text,
  liturgical_season text,
  scripture_reference text,
  estimated_read_time integer,
  cover_image text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_prayer_tags (
  prayer_id uuid not null references public.content_prayers(id) on delete cascade,
  tag_id uuid not null references public.content_tags(id) on delete cascade,
  primary key (prayer_id, tag_id)
);

create table if not exists public.content_collection_items (
  collection_id uuid not null references public.content_collections(id) on delete cascade,
  content_type text not null,
  content_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, content_type, content_id)
);

create table if not exists public.content_relationships (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  relationship_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  content_id uuid not null,
  version_number integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_type, content_id, version_number)
);

create index if not exists idx_content_categories_parent on public.content_categories(parent_id);
create index if not exists idx_content_categories_active_sort on public.content_categories(is_active, sort_order, name);
create index if not exists idx_content_prayers_status on public.content_prayers(status);
create index if not exists idx_content_prayers_category on public.content_prayers(category_id);
create index if not exists idx_content_prayers_language on public.content_prayers(language_id);
create index if not exists idx_content_prayers_featured on public.content_prayers(featured);
create index if not exists idx_content_prayers_search
  on public.content_prayers using gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(body, '') || ' ' || coalesce(author, '') || ' ' || coalesce(scripture_reference, ''))
  );
create index if not exists idx_content_relationships_source on public.content_relationships(source_type, source_id);
create index if not exists idx_content_relationships_target on public.content_relationships(target_type, target_id);
create index if not exists idx_content_versions_content on public.content_versions(content_type, content_id, version_number desc);

drop trigger if exists set_content_categories_updated_at on public.content_categories;
create trigger set_content_categories_updated_at
before update on public.content_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_content_collections_updated_at on public.content_collections;
create trigger set_content_collections_updated_at
before update on public.content_collections
for each row execute function public.set_updated_at();

drop trigger if exists set_content_prayers_updated_at on public.content_prayers;
create trigger set_content_prayers_updated_at
before update on public.content_prayers
for each row execute function public.set_updated_at();

create or replace function public.capture_content_prayer_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next
  from public.content_versions
  where content_type = 'prayer'
    and content_id = new.id;

  insert into public.content_versions (content_type, content_id, version_number, snapshot, created_by)
  values ('prayer', new.id, v_next, to_jsonb(new), auth.uid());

  return new;
end;
$$;

drop trigger if exists capture_content_prayer_version on public.content_prayers;
create trigger capture_content_prayer_version
after insert or update on public.content_prayers
for each row execute function public.capture_content_prayer_version();

alter table public.content_categories enable row level security;
alter table public.content_tags enable row level security;
alter table public.content_languages enable row level security;
alter table public.content_collections enable row level security;
alter table public.content_prayers enable row level security;
alter table public.content_prayer_tags enable row level security;
alter table public.content_collection_items enable row level security;
alter table public.content_relationships enable row level security;
alter table public.content_versions enable row level security;

drop policy if exists "Authenticated users can read CMS categories" on public.content_categories;
create policy "Authenticated users can read CMS categories"
on public.content_categories for select to authenticated
using (is_active or public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Super admins manage CMS categories" on public.content_categories;
create policy "Super admins manage CMS categories"
on public.content_categories for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Authenticated users can read CMS tags" on public.content_tags;
create policy "Authenticated users can read CMS tags"
on public.content_tags for select to authenticated
using (true);

drop policy if exists "Super admins manage CMS tags" on public.content_tags;
create policy "Super admins manage CMS tags"
on public.content_tags for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Authenticated users can read CMS languages" on public.content_languages;
create policy "Authenticated users can read CMS languages"
on public.content_languages for select to authenticated
using (true);

drop policy if exists "Super admins manage CMS languages" on public.content_languages;
create policy "Super admins manage CMS languages"
on public.content_languages for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Authenticated users can read published CMS collections" on public.content_collections;
create policy "Authenticated users can read published CMS collections"
on public.content_collections for select to authenticated
using (status in ('published', 'featured') or public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Super admins manage CMS collections" on public.content_collections;
create policy "Super admins manage CMS collections"
on public.content_collections for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Authenticated users can read published CMS prayers" on public.content_prayers;
create policy "Authenticated users can read published CMS prayers"
on public.content_prayers for select to authenticated
using (status in ('published', 'featured') or public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Super admins manage CMS prayers" on public.content_prayers;
create policy "Super admins manage CMS prayers"
on public.content_prayers for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Authenticated users can read CMS prayer tags" on public.content_prayer_tags;
create policy "Authenticated users can read CMS prayer tags"
on public.content_prayer_tags for select to authenticated
using (true);

drop policy if exists "Super admins manage CMS prayer tags" on public.content_prayer_tags;
create policy "Super admins manage CMS prayer tags"
on public.content_prayer_tags for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Authenticated users can read CMS collection items" on public.content_collection_items;
create policy "Authenticated users can read CMS collection items"
on public.content_collection_items for select to authenticated
using (true);

drop policy if exists "Super admins manage CMS collection items" on public.content_collection_items;
create policy "Super admins manage CMS collection items"
on public.content_collection_items for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Authenticated users can read CMS relationships" on public.content_relationships;
create policy "Authenticated users can read CMS relationships"
on public.content_relationships for select to authenticated
using (true);

drop policy if exists "Super admins manage CMS relationships" on public.content_relationships;
create policy "Super admins manage CMS relationships"
on public.content_relationships for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Super admins read CMS versions" on public.content_versions;
create policy "Super admins read CMS versions"
on public.content_versions for select to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

insert into public.content_languages (code, name, native_name, is_default)
values
  ('en', 'English', 'English', true),
  ('sw', 'Swahili', 'Kiswahili', false),
  ('la', 'Latin', 'Latina', false)
on conflict (code) do update
set name = excluded.name,
    native_name = excluded.native_name;

insert into public.content_categories (name, slug, description, icon, color, sort_order)
values
  ('Morning', 'morning', 'Prayers for beginning the day.', 'sunrise', '#f59e0b', 10),
  ('Evening', 'evening', 'Prayers for closing the day.', 'moon', '#6366f1', 20),
  ('Healing', 'healing', 'Prayers for healing and restoration.', 'heart-pulse', '#ef4444', 30),
  ('Family', 'family', 'Prayers for households and family life.', 'home', '#22c55e', 40),
  ('Children', 'children', 'Prayers for children and young people.', 'baby', '#06b6d4', 50),
  ('Marriage', 'marriage', 'Prayers for marriage and vocation.', 'rings', '#ec4899', 60),
  ('Priests', 'priests', 'Prayers for clergy and vocations.', 'church', '#a855f7', 70),
  ('Marian', 'marian', 'Prayers honoring the Blessed Virgin Mary.', 'sparkles', '#3b82f6', 80),
  ('Rosary', 'rosary', 'Rosary prayers and mysteries.', 'circle-dot', '#8b5cf6', 90),
  ('Chaplets', 'chaplets', 'Chaplets and structured devotional prayers.', 'circle', '#f97316', 100),
  ('Novenas', 'novenas', 'Nine-day prayers and novena sets.', 'calendar-days', '#14b8a6', 110),
  ('Litanies', 'litanies', 'Litanies and responses.', 'list', '#64748b', 120),
  ('Devotions', 'devotions', 'Popular Catholic devotions.', 'book-heart', '#84cc16', 130),
  ('Thanksgiving', 'thanksgiving', 'Prayers of gratitude.', 'gift', '#eab308', 140),
  ('Intercession', 'intercession', 'Prayers asking intercession.', 'hand-heart', '#0ea5e9', 150),
  ('Protection', 'protection', 'Prayers for protection.', 'shield', '#475569', 160),
  ('Funeral', 'funeral', 'Prayers for the dead and grieving.', 'flower', '#71717a', 170),
  ('Adoration', 'adoration', 'Eucharistic adoration prayers.', 'flame', '#dc2626', 180),
  ('Eucharistic', 'eucharistic', 'Prayers centered on the Eucharist.', 'wheat', '#ca8a04', 190),
  ('Lent', 'lent', 'Lenten prayers and practices.', 'cross', '#7c3aed', 200),
  ('Advent', 'advent', 'Advent prayers and preparation.', 'candle', '#9333ea', 210),
  ('Christmas', 'christmas', 'Christmas season prayers.', 'star', '#16a34a', 220),
  ('Ordinary Time', 'ordinary-time', 'Prayers for Ordinary Time.', 'leaf', '#22c55e', 230),
  ('Holy Week', 'holy-week', 'Holy Week prayers and meditations.', 'cross', '#991b1b', 240),
  ('Easter', 'easter', 'Easter season prayers.', 'sun', '#facc15', 250),
  ('Pentecost', 'pentecost', 'Prayers to the Holy Spirit.', 'flame', '#ef4444', 260)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color,
    sort_order = excluded.sort_order,
    is_active = true;

insert into public.content_tags (name, slug, color)
values
  ('Hope', 'hope', '#22c55e'),
  ('Mercy', 'mercy', '#0ea5e9'),
  ('Faith', 'faith', '#f59e0b'),
  ('Forgiveness', 'forgiveness', '#8b5cf6'),
  ('Peace', 'peace', '#06b6d4'),
  ('Youth', 'youth', '#ec4899'),
  ('Parents', 'parents', '#14b8a6'),
  ('Healing', 'healing', '#ef4444'),
  ('Family', 'family', '#22c55e'),
  ('Love', 'love', '#f43f5e'),
  ('Holy Spirit', 'holy-spirit', '#dc2626'),
  ('Saint Joseph', 'saint-joseph', '#64748b'),
  ('Our Lady', 'our-lady', '#3b82f6')
on conflict (slug) do update
set name = excluded.name,
    color = excluded.color;

insert into public.content_collections (title, slug, description, featured, status)
values
  ('Morning Prayers', 'morning-prayers', 'A curated collection for beginning the day with God.', true, 'published'),
  ('Family Prayer Pack', 'family-prayer-pack', 'Prayers for families, parents, and children.', true, 'published'),
  ('Healing Collection', 'healing-collection', 'Prayers for healing, comfort, and peace.', false, 'published'),
  ('Lenten Collection', 'lenten-collection', 'Seasonal prayers for Lent.', false, 'published'),
  ('Rosary Collection', 'rosary-collection', 'Rosary prayers and Marian devotions.', true, 'published'),
  ('Children''s Collection', 'childrens-collection', 'Prayers written for children and youth.', false, 'published'),
  ('Marriage Preparation', 'marriage-preparation', 'Prayers for couples preparing for marriage.', false, 'published'),
  ('Funeral Prayers', 'funeral-prayers', 'Prayers for mourning, hope, and eternal rest.', false, 'published'),
  ('Divine Mercy', 'divine-mercy', 'Prayers of mercy and trust in Christ.', true, 'published')
on conflict (slug) do update
set title = excluded.title,
    description = excluded.description,
    featured = excluded.featured,
    status = excluded.status;
