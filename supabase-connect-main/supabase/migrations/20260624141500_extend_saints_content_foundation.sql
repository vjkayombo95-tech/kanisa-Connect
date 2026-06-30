-- Catholic Content Platform Phase 1.1: extend Saints for production content management.

alter table public.saints
add column if not exists liturgical_rank text,
add column if not exists is_featured boolean not null default false,
add column if not exists scripture_reference text,
add column if not exists tags text[] not null default '{}'::text[];

create index if not exists saints_is_featured_idx
on public.saints (is_featured);

create index if not exists saints_tags_idx
on public.saints using gin (tags);

drop function if exists public.get_saint_of_the_day();

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
  color_theme text,
  liturgical_rank text,
  is_featured boolean,
  scripture_reference text,
  tags text[]
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
    s.color_theme,
    s.liturgical_rank,
    s.is_featured,
    s.scripture_reference,
    s.tags
  from public.saints s
  where s.is_active = true
    and s.feast_month = extract(month from current_date)::integer
    and s.feast_day = extract(day from current_date)::integer
  order by s.is_featured desc, s.name asc;
$$;

grant execute on function public.get_saint_of_the_day() to authenticated;
