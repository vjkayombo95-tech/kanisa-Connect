-- Repair AI announcement generator storage on live projects.
-- Some projects have message_templates.body from a later repair migration, while
-- the app expects message_templates.content and a messages table for sent drafts.

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text,
  body text,
  type text not null default 'announcement',
  category text not null default 'announcement',
  language text not null default 'sw',
  tone text,
  occasion text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.message_templates
  add column if not exists church_id uuid references public.churches(id) on delete cascade,
  add column if not exists title text,
  add column if not exists content text,
  add column if not exists body text,
  add column if not exists type text not null default 'announcement',
  add column if not exists category text not null default 'announcement',
  add column if not exists language text not null default 'sw',
  add column if not exists tone text,
  add column if not exists occasion text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.message_templates
set content = body
where content is null
  and body is not null;

update public.message_templates
set body = content
where body is null
  and content is not null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  title text not null,
  content text not null,
  status text not null default 'draft',
  language text default 'sw',
  type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.messages
  add column if not exists church_id uuid references public.churches(id) on delete cascade,
  add column if not exists title text,
  add column if not exists content text,
  add column if not exists status text not null default 'draft',
  add column if not exists language text default 'sw',
  add column if not exists type text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_message_templates_type_language
  on public.message_templates(type, language);

create index if not exists idx_message_templates_church_id
  on public.message_templates(church_id);

create index if not exists idx_messages_church_id_created_at
  on public.messages(church_id, created_at desc);

alter table public.message_templates enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Authenticated users can view message templates" on public.message_templates;
drop policy if exists "message_templates_select_access" on public.message_templates;
create policy "message_templates_select_access"
on public.message_templates
for select
to authenticated
using (
  church_id is null
  or public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = message_templates.church_id
  )
  or exists (
    select 1
    from public.members m
    where m.user_id = auth.uid()
      and m.church_id = message_templates.church_id
  )
);

drop policy if exists "Church admins can manage message templates" on public.message_templates;
drop policy if exists "message_templates_manage_by_role" on public.message_templates;
create policy "message_templates_manage_by_role"
on public.message_templates
for all
to authenticated
using (
  public.is_super_admin(auth.uid())
  or (
    church_id is not null
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = message_templates.church_id
        and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
    )
  )
)
with check (
  public.is_super_admin(auth.uid())
  or (
    church_id is not null
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = message_templates.church_id
        and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
    )
  )
);

drop policy if exists "Church members can view sent messages" on public.messages;
create policy "Church members can view sent messages"
on public.messages
for select
to authenticated
using (
  status = 'sent'
  and (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = messages.church_id
    )
    or exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.church_id = messages.church_id
    )
  )
);

drop policy if exists "Church admins can create messages" on public.messages;
create policy "Church admins can create messages"
on public.messages
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = messages.church_id
        and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
    )
  )
);

drop policy if exists "Church admins can update messages" on public.messages;
create policy "Church admins can update messages"
on public.messages
for update
to authenticated
using (
  public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = messages.church_id
      and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
  )
)
with check (
  public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = messages.church_id
      and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
  )
);

drop policy if exists "Church admins can delete messages" on public.messages;
create policy "Church admins can delete messages"
on public.messages
for delete
to authenticated
using (
  public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = messages.church_id
      and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
  )
);

grant select, insert, update, delete on public.message_templates to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

insert into public.message_templates (title, content, body, type, category, language, tone, occasion)
select seeded.title, seeded.content, seeded.content, seeded.type, 'announcement', seeded.language, 'warm', seeded.type
from (
  values
    ('Ibada ya Jumapili Wiki Hii', 'Kanisa linawakaribisha waumini wote kwenye ibada ya Jumapili hii. Njoo tushirikiane katika kuabudu, kusikiliza neno la Mungu na kuombeana kama familia ya imani.', 'service', 'sw'),
    ('Tusikose Ibada ya Jumapili', 'Tunawakumbusha waumini wote kuhusu ibada ya Jumapili ijayo. Huu ni wakati wa kujengwa kiroho, kuungana na wengine na kumtukuza Mungu pamoja.', 'service', 'sw'),
    ('This Week''s Sunday Service', 'You are warmly invited to our Sunday service this week. Let us gather in faith, worship together, and receive encouragement from the Word of God.', 'service', 'en'),
    ('Mkutano wa Vijana', 'Tunawaalika vijana wote kwenye mkutano wetu ujao kwa ushirika, maombi na kupanga huduma. Karibuni tushiriki na kukua pamoja.', 'youth', 'sw'),
    ('Youth Meeting', 'All youth are invited to join our upcoming meeting for fellowship, prayer and planning. Come ready to participate and grow together.', 'youth', 'en'),
    ('Mkutano wa Maombi', 'Karibuni kwenye mkutano wa maombi. Tukutane kwa imani, tushirikishe mahitaji yetu na tumtafute Mungu pamoja.', 'prayer', 'sw'),
    ('Prayer Meeting', 'You are warmly invited to our prayer meeting. Let us gather in faith, share our needs and seek God together.', 'prayer', 'en'),
    ('Tukio Maalum', 'Kanisa linawatangazia tukio maalum lijalo. Karibuni kushiriki, kualika wengine na kuwa sehemu ya wakati huu muhimu wa jumuiya yetu.', 'event', 'sw'),
    ('Special Event', 'The church invites everyone to our upcoming special event. Please join us, invite others and be part of this meaningful community moment.', 'event', 'en')
) as seeded(title, content, type, language)
where not exists (
  select 1
  from public.message_templates existing
  where existing.type = seeded.type
    and existing.language = seeded.language
    and coalesce(existing.title, '') = seeded.title
);
