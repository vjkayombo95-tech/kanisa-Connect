alter table public.contributions
  add column if not exists date date;

update public.contributions
set date = coalesce(date, created_at::date, current_date)
where date is null;

alter table public.contributions
  alter column date set default current_date;

alter table public.bible_verses
  add column if not exists church_id uuid references public.churches(id),
  add column if not exists "text" text,
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz;

update public.bible_verses
set "text" = coalesce("text", verse_text)
where "text" is null;
