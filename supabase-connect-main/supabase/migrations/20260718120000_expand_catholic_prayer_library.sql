-- Extend the existing Catholic CMS prayer model into a tenant-aware prayer library.
-- Global prayers are platform-owned (is_global = true, church_id is null).
-- Parish prayers are owned by exactly one church (is_global = false, church_id is set).

create extension if not exists pgcrypto;

alter table public.content_prayers
  alter column body drop not null;

alter table public.content_prayers
  add column if not exists prayer_code text,
  add column if not exists parent_prayer_id uuid references public.content_prayers(id) on delete cascade,
  add column if not exists prayer_type text not null default 'single',
  add column if not exists recommended_time text,
  add column if not exists audio_url text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_global boolean not null default true,
  add column if not exists church_id uuid references public.churches(id) on delete cascade,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists content_prayers_prayer_code_key
  on public.content_prayers(prayer_code) where prayer_code is not null;
create index if not exists idx_content_prayers_church_id on public.content_prayers(church_id);
create index if not exists idx_content_prayers_global_status on public.content_prayers(is_global, status);
create index if not exists idx_content_prayers_parent on public.content_prayers(parent_prayer_id);
create index if not exists idx_content_prayers_sort_order on public.content_prayers(sort_order);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'content_prayers_prayer_type_check') then
    alter table public.content_prayers add constraint content_prayers_prayer_type_check
      check (prayer_type in ('single', 'collection', 'section', 'litany', 'rosary', 'stations_of_cross', 'mass_collection'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'content_prayers_tenant_check') then
    alter table public.content_prayers add constraint content_prayers_tenant_check
      check ((is_global and church_id is null) or (not is_global and church_id is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'content_prayers_published_body_check') then
    alter table public.content_prayers add constraint content_prayers_published_body_check
      check (status not in ('published', 'featured') or nullif(btrim(body), '') is not null) not valid;
  end if;
end $$;

create table if not exists public.prayer_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prayer_id uuid not null references public.content_prayers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, prayer_id)
);

create table if not exists public.prayer_reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prayer_id uuid not null references public.content_prayers(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  read_count integer not null default 1 check (read_count > 0),
  unique(user_id, prayer_id)
);

create index if not exists idx_prayer_favorites_user on public.prayer_favorites(user_id);
create index if not exists idx_prayer_history_user_last_read
  on public.prayer_reading_history(user_id, last_read_at desc);

alter table public.prayer_favorites enable row level security;
alter table public.prayer_reading_history enable row level security;

create or replace function public.validate_prayer_parent_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.content_prayers%rowtype;
  v_cursor uuid;
  v_seen uuid[] := array[]::uuid[];
begin
  if new.parent_prayer_id is null then return new; end if;
  if new.parent_prayer_id = new.id then raise exception 'A prayer cannot be its own parent' using errcode = '23514'; end if;
  select * into v_parent from public.content_prayers where id = new.parent_prayer_id;
  if not found then raise exception 'Parent prayer does not exist' using errcode = '23503'; end if;
  if v_parent.prayer_type not in ('collection', 'rosary', 'stations_of_cross', 'mass_collection') then
    raise exception 'Parent prayer must be a structured collection' using errcode = '23514';
  end if;
  if v_parent.is_global is distinct from new.is_global or v_parent.church_id is distinct from new.church_id then
    raise exception 'Parent and child prayers must have the same owner' using errcode = '23514';
  end if;

  -- Walk the parent chain without recursive SQL so malformed pre-existing data
  -- cannot create or extend a cycle.
  v_cursor := v_parent.parent_prayer_id;
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'Prayer parent relationship would create a cycle' using errcode = '23514';
    end if;
    if v_cursor = any(v_seen) then
      raise exception 'Prayer parent chain already contains a cycle' using errcode = '23514';
    end if;
    v_seen := array_append(v_seen, v_cursor);
    select parent_prayer_id into v_cursor
    from public.content_prayers
    where id = v_cursor;
    if not found then
      raise exception 'Prayer parent chain is invalid' using errcode = '23503';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.validate_prayer_parent_tenant() from public;

drop trigger if exists validate_prayer_parent_tenant on public.content_prayers;
create trigger validate_prayer_parent_tenant
before insert or update of parent_prayer_id, is_global, church_id on public.content_prayers
for each row execute function public.validate_prayer_parent_tenant();

create or replace function public.record_prayer_read(_prayer_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.content_prayers where id = _prayer_id and status in ('published', 'featured')) then
    raise exception 'Prayer is not available' using errcode = '42501';
  end if;
  insert into public.prayer_reading_history(user_id, prayer_id)
  values (auth.uid(), _prayer_id)
  on conflict (user_id, prayer_id) do update
  set read_count = public.prayer_reading_history.read_count + 1,
      last_read_at = now();
end;
$$;

revoke all on function public.record_prayer_read(uuid) from public;

drop policy if exists "Authenticated users can read published CMS prayers" on public.content_prayers;
drop policy if exists "Members read tenant-visible published prayers" on public.content_prayers;
create policy "Members read tenant-visible published prayers"
on public.content_prayers for select to authenticated
using (
  (
    status in ('published', 'featured')
    and (
      (is_global and church_id is null)
      or (
        not is_global
        and church_id is not null
        and public.is_church_member(auth.uid(), church_id)
      )
    )
  )
  or public.is_platform_super_admin(auth.uid())
  or public.is_super_admin(auth.uid())
  or (
    not is_global
    and church_id is not null
    and public.can_manage_church_workspace(auth.uid(), church_id)
  )
);

drop policy if exists "Super admins manage CMS prayers" on public.content_prayers;
drop policy if exists "Super admins manage global prayers" on public.content_prayers;
create policy "Super admins manage global prayers"
on public.content_prayers for all to authenticated
using (
  is_global
  and church_id is null
  and (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
)
with check (
  is_global
  and church_id is null
  and (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
);

drop policy if exists "Church admins insert parish prayers" on public.content_prayers;
create policy "Church admins insert parish prayers"
on public.content_prayers for insert to authenticated
with check (
  not is_global
  and church_id is not null
  and public.can_manage_church_workspace(auth.uid(), church_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Church admins update parish prayers" on public.content_prayers;
create policy "Church admins update parish prayers"
on public.content_prayers for update to authenticated
using (
  not is_global
  and church_id is not null
  and public.can_manage_church_workspace(auth.uid(), church_id)
)
with check (
  not is_global
  and church_id is not null
  and public.can_manage_church_workspace(auth.uid(), church_id)
);

drop policy if exists "Church admins delete parish prayers" on public.content_prayers;
create policy "Church admins delete parish prayers"
on public.content_prayers for delete to authenticated
using (
  not is_global
  and church_id is not null
  and public.can_manage_church_workspace(auth.uid(), church_id)
);

drop policy if exists "Users read own prayer favorites" on public.prayer_favorites;
drop policy if exists "Users create own prayer favorites" on public.prayer_favorites;
drop policy if exists "Users delete own prayer favorites" on public.prayer_favorites;
create policy "Users read own prayer favorites" on public.prayer_favorites
for select to authenticated using (user_id = auth.uid());
create policy "Users create own prayer favorites" on public.prayer_favorites
for insert to authenticated with check (user_id = auth.uid());
create policy "Users delete own prayer favorites" on public.prayer_favorites
for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Users read own prayer history" on public.prayer_reading_history;
drop policy if exists "Users create own prayer history" on public.prayer_reading_history;
drop policy if exists "Users update own prayer history" on public.prayer_reading_history;
create policy "Users read own prayer history" on public.prayer_reading_history
for select to authenticated using (user_id = auth.uid());
create policy "Users create own prayer history" on public.prayer_reading_history
for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own prayer history" on public.prayer_reading_history
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

comment on column public.content_prayers.is_global is
  'True for platform-owned prayers visible across churches; only super admins may manage them.';
comment on column public.content_prayers.church_id is
  'Owning church for parish-authored prayers. Null for global prayers.';
comment on column public.content_prayers.parent_prayer_id is
  'Optional parent for ordered Rosary, Stations, Mass, and other structured prayer collections.';

insert into public.content_categories (name, slug, description, icon, sort_order, is_active)
values
  ('Sala za Kila Siku', 'daily-prayers', 'Sala za matumizi ya kila siku.', 'sunrise', 10, true),
  ('Sala za Msingi wa Imani', 'foundations-of-faith', 'Sala za msingi wa imani Katoliki.', 'book-open', 20, true),
  ('Amri na Mafundisho ya Kanisa', 'commandments', 'Amri na mafundisho ya Kanisa.', 'scroll-text', 30, true),
  ('Sala za Bikira Maria', 'marian-prayers', 'Sala zinazomheshimu Bikira Maria.', 'sparkles', 40, true),
  ('Rozari', 'rosary', 'Rozari na mafumbo yake.', 'circle-dot', 50, true),
  ('Watakatifu na Malaika', 'saints-and-angels', 'Sala kwa watakatifu na malaika.', 'shield', 60, true),
  ('Sala za Mafundisho', 'catechism', 'Sala zinazotumika wakati wa mafundisho.', 'graduation-cap', 70, true),
  ('Sala za Misa Takatifu', 'mass-prayers', 'Sala zinazohusiana na Misa Takatifu.', 'church', 80, true),
  ('Njia ya Msalaba', 'stations-of-the-cross', 'Sala za Njia ya Msalaba.', 'cross', 90, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    is_active = true;

-- Titles only: bodies remain null and records remain drafts until reviewed text is imported.
with seed(prayer_code, category_slug, title, slug, prayer_type, sort_order) as (
  values
    ('sala-ya-asubuhi', 'daily-prayers', 'Sala ya Asubuhi', 'sala-ya-asubuhi', 'single', 10),
    ('nia-njema', 'daily-prayers', 'Nia Njema', 'nia-njema', 'single', 20),
    ('sala-kabla-ya-kula', 'daily-prayers', 'Sala Kabla ya Kula', 'sala-kabla-ya-kula', 'single', 30),
    ('sala-baada-ya-kula', 'daily-prayers', 'Sala Baada ya Kula', 'sala-baada-ya-kula', 'single', 40),
    ('sala-kabla-ya-kazi', 'daily-prayers', 'Sala Kabla ya Kazi', 'sala-kabla-ya-kazi', 'single', 50),
    ('baba-yetu', 'foundations-of-faith', 'Baba Yetu', 'baba-yetu', 'single', 10),
    ('salamu-maria', 'foundations-of-faith', 'Salamu Maria', 'salamu-maria', 'single', 20),
    ('kanuni-ya-imani', 'foundations-of-faith', 'Kanuni ya Imani', 'kanuni-ya-imani', 'single', 30),
    ('sala-ya-imani', 'foundations-of-faith', 'Sala ya Imani', 'sala-ya-imani', 'single', 40),
    ('sala-ya-matumaini', 'foundations-of-faith', 'Sala ya Matumaini', 'sala-ya-matumaini', 'single', 50),
    ('sala-ya-mapendo', 'foundations-of-faith', 'Sala ya Mapendo', 'sala-ya-mapendo', 'single', 60),
    ('sala-ya-kutubu', 'foundations-of-faith', 'Sala ya Kutubu', 'sala-ya-kutubu', 'single', 70),
    ('amri-za-mungu', 'commandments', 'Amri za Mungu', 'amri-za-mungu', 'single', 10),
    ('amri-za-kanisa', 'commandments', 'Amri za Kanisa', 'amri-za-kanisa', 'single', 20),
    ('malaika-wa-bwana', 'marian-prayers', 'Malaika wa Bwana', 'malaika-wa-bwana', 'single', 10),
    ('malkia-wa-mbingu', 'marian-prayers', 'Malkia wa Mbingu', 'malkia-wa-mbingu', 'single', 20),
    ('tunakimbilia', 'marian-prayers', 'Tunakimbilia', 'tunakimbilia', 'single', 30),
    ('litania-ya-bikira-maria', 'marian-prayers', 'Litania ya Bikira Maria', 'litania-ya-bikira-maria', 'litany', 40),
    ('sala-kwa-malaika-mlinzi', 'saints-and-angels', 'Sala kwa Malaika Mlinzi', 'sala-kwa-malaika-mlinzi', 'single', 10),
    ('sala-kabla-ya-mafundisho', 'catechism', 'Sala Kabla ya Mafundisho', 'sala-kabla-ya-mafundisho', 'single', 10),
    ('sala-baada-ya-mafundisho', 'catechism', 'Sala Baada ya Mafundisho', 'sala-baada-ya-mafundisho', 'single', 20),
    ('sala-ya-matoleo', 'mass-prayers', 'Sala ya Matoleo', 'sala-ya-matoleo', 'single', 10),
    ('tuombe', 'mass-prayers', 'Tuombe', 'tuombe', 'single', 20),
    ('sala-za-misa-takatifu', 'mass-prayers', 'Sala za Misa Takatifu', 'sala-za-misa-takatifu', 'mass_collection', 30),
    ('mafungu-ya-rozari', 'rosary', 'Mafungu ya Rozari', 'mafungu-ya-rozari', 'rosary', 10),
    ('njia-ya-msalaba', 'stations-of-the-cross', 'Njia ya Msalaba', 'njia-ya-msalaba', 'stations_of_cross', 10)
)
insert into public.content_prayers (
  prayer_code, category_id, title, slug, body, language_id, status, visibility,
  prayer_type, sort_order, is_global, church_id, metadata
)
select seed.prayer_code, category.id, seed.title, seed.slug, null, language.id, 'draft', 'member',
       seed.prayer_type, seed.sort_order, true, null, jsonb_build_object('seeded_title_only', true)
from seed
join public.content_categories category on category.slug = seed.category_slug
join public.content_languages language on language.code = 'sw'
on conflict (slug) do update
set prayer_code = coalesce(public.content_prayers.prayer_code, excluded.prayer_code),
    category_id = coalesce(public.content_prayers.category_id, excluded.category_id),
    language_id = coalesce(public.content_prayers.language_id, excluded.language_id)
where public.content_prayers.prayer_code is null
   or public.content_prayers.category_id is null
   or public.content_prayers.language_id is null;

-- Draft child sections establish ordering without supplying or fabricating prayer text.
with child(parent_code, prayer_code, title, slug, sort_order) as (
  values
    ('mafungu-ya-rozari', 'rozari-jinsi-ya-kusali', 'Jinsi ya Kusali Rozari', 'jinsi-ya-kusali-rozari', 1),
    ('mafungu-ya-rozari', 'rozari-mafumbo-ya-furaha', 'Mafumbo ya Furaha', 'mafumbo-ya-furaha', 2),
    ('mafungu-ya-rozari', 'rozari-mafumbo-ya-mwanga', 'Mafumbo ya Mwanga', 'mafumbo-ya-mwanga', 3),
    ('mafungu-ya-rozari', 'rozari-mafumbo-ya-uchungu', 'Mafumbo ya Uchungu', 'mafumbo-ya-uchungu', 4),
    ('mafungu-ya-rozari', 'rozari-mafumbo-ya-utukufu', 'Mafumbo ya Utukufu', 'mafumbo-ya-utukufu', 5),
    ('njia-ya-msalaba', 'msalaba-utangulizi', 'Utangulizi', 'njia-ya-msalaba-utangulizi', 1),
    ('njia-ya-msalaba', 'msalaba-kituo-01', 'Kituo cha Kwanza', 'kituo-cha-kwanza', 2),
    ('njia-ya-msalaba', 'msalaba-kituo-02', 'Kituo cha Pili', 'kituo-cha-pili', 3),
    ('njia-ya-msalaba', 'msalaba-kituo-03', 'Kituo cha Tatu', 'kituo-cha-tatu', 4),
    ('njia-ya-msalaba', 'msalaba-kituo-04', 'Kituo cha Nne', 'kituo-cha-nne', 5),
    ('njia-ya-msalaba', 'msalaba-kituo-05', 'Kituo cha Tano', 'kituo-cha-tano', 6),
    ('njia-ya-msalaba', 'msalaba-kituo-06', 'Kituo cha Sita', 'kituo-cha-sita', 7),
    ('njia-ya-msalaba', 'msalaba-kituo-07', 'Kituo cha Saba', 'kituo-cha-saba', 8),
    ('njia-ya-msalaba', 'msalaba-kituo-08', 'Kituo cha Nane', 'kituo-cha-nane', 9),
    ('njia-ya-msalaba', 'msalaba-kituo-09', 'Kituo cha Tisa', 'kituo-cha-tisa', 10),
    ('njia-ya-msalaba', 'msalaba-kituo-10', 'Kituo cha Kumi', 'kituo-cha-kumi', 11),
    ('njia-ya-msalaba', 'msalaba-kituo-11', 'Kituo cha Kumi na Moja', 'kituo-cha-kumi-na-moja', 12),
    ('njia-ya-msalaba', 'msalaba-kituo-12', 'Kituo cha Kumi na Mbili', 'kituo-cha-kumi-na-mbili', 13),
    ('njia-ya-msalaba', 'msalaba-kituo-13', 'Kituo cha Kumi na Tatu', 'kituo-cha-kumi-na-tatu', 14),
    ('njia-ya-msalaba', 'msalaba-kituo-14', 'Kituo cha Kumi na Nne', 'kituo-cha-kumi-na-nne', 15),
    ('njia-ya-msalaba', 'msalaba-mwisho', 'Sala ya Kumalizia', 'njia-ya-msalaba-sala-ya-kumalizia', 16),
    ('sala-za-misa-takatifu', 'misa-kutubio', 'Kitubio', 'misa-kutubio', 1),
    ('sala-za-misa-takatifu', 'misa-bwana-utuhurumie', 'Bwana Utuhurumie', 'misa-bwana-utuhurumie', 2),
    ('sala-za-misa-takatifu', 'misa-utukufu', 'Utukufu', 'misa-utukufu', 3),
    ('sala-za-misa-takatifu', 'misa-kanuni-ya-imani', 'Kanuni ya Imani', 'misa-kanuni-ya-imani', 4),
    ('sala-za-misa-takatifu', 'misa-mtakatifu', 'Mtakatifu', 'misa-mtakatifu', 5),
    ('sala-za-misa-takatifu', 'misa-mwanakondoo', 'Mwanakondoo wa Mungu', 'misa-mwanakondoo-wa-mungu', 6),
    ('sala-za-misa-takatifu', 'misa-ee-bwana-sistahili', 'Ee Bwana Sistahili', 'misa-ee-bwana-sistahili', 7),
    ('sala-za-misa-takatifu', 'misa-baada-ya-komunyo', 'Sala Baada ya Komunyo', 'misa-sala-baada-ya-komunyo', 8)
)
insert into public.content_prayers (
  prayer_code, parent_prayer_id, category_id, title, slug, body, language_id, status,
  visibility, prayer_type, sort_order, is_global, church_id, metadata
)
select child.prayer_code, parent.id, parent.category_id, child.title, child.slug, null,
       parent.language_id, 'draft', 'member', 'section', child.sort_order, true, null,
       jsonb_build_object('seeded_title_only', true)
from child
join public.content_prayers parent on parent.prayer_code = child.parent_code
on conflict (slug) do update
set prayer_code = coalesce(public.content_prayers.prayer_code, excluded.prayer_code),
    parent_prayer_id = coalesce(public.content_prayers.parent_prayer_id, excluded.parent_prayer_id)
where public.content_prayers.prayer_code is null
   or public.content_prayers.parent_prayer_id is null;

grant select, insert, update, delete on public.prayer_favorites to authenticated;
grant select, insert, update on public.prayer_reading_history to authenticated;
grant execute on function public.record_prayer_read(uuid) to authenticated;
