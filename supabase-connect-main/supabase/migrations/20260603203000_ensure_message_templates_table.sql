create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches(id) on delete cascade,
  title text not null,
  body text not null,
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
  add column if not exists type text not null default 'announcement';

update public.message_templates
set type = occasion
where type = 'announcement'
  and occasion is not null
  and occasion <> '';

create index if not exists message_templates_church_id_idx
  on public.message_templates(church_id);

create index if not exists message_templates_type_language_idx
  on public.message_templates(type, language);

create index if not exists message_templates_category_language_idx
  on public.message_templates(category, language);

alter table public.message_templates enable row level security;

drop policy if exists "message_templates_select_access" on public.message_templates;
create policy "message_templates_select_access"
  on public.message_templates
  for select
  to authenticated
  using (
    church_id is null
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

drop policy if exists "message_templates_manage_by_role" on public.message_templates;
create policy "message_templates_manage_by_role"
  on public.message_templates
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = message_templates.church_id
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = message_templates.church_id
    )
  );

grant select, insert, update, delete on public.message_templates to authenticated;

insert into public.message_templates (title, body, type, category, language, tone, occasion)
values
  (
    'Ibada ya Jumapili Wiki Hii',
    'Kanisa linawakaribisha waumini wote kwenye ibada ya Jumapili hii. Njoo tushirikiane katika kuabudu, kusikiliza neno la Mungu na kuombeana kama familia ya imani.',
    'sunday_service',
    'announcement',
    'sw',
    'warm',
    'sunday_service'
  ),
  (
    'Tusikose Ibada ya Jumapili',
    'Tunawakumbusha waumini wote kuhusu ibada ya Jumapili ijayo. Huu ni wakati wa kujengwa kiroho, kuungana na wengine na kumtukuza Mungu pamoja.',
    'sunday_service',
    'announcement',
    'sw',
    'encouraging',
    'sunday_service'
  ),
  (
    'Youth Meeting',
    'All youth are invited to join our upcoming meeting for fellowship, prayer and planning. Come ready to participate and grow together.',
    'youth_meeting',
    'announcement',
    'en',
    'friendly',
    'youth_meeting'
  ),
  (
    'Prayer Meeting',
    'You are warmly invited to our prayer meeting. Let us gather in faith, share our needs and seek God together.',
    'prayer_meeting',
    'announcement',
    'en',
    'warm',
    'prayer_meeting'
  ),
  (
    'Mkutano wa Vijana',
    'Tunawaalika vijana wote kwenye mkutano wetu ujao kwa ushirika, maombi na kupanga huduma. Karibuni tushiriki na kukua pamoja.',
    'youth_meeting',
    'announcement',
    'sw',
    'friendly',
    'youth_meeting'
  ),
  (
    'Mkutano wa Maombi',
    'Karibuni kwenye mkutano wa maombi. Tukutane kwa imani, tushirikishe mahitaji yetu na tumtafute Mungu pamoja.',
    'prayer_meeting',
    'announcement',
    'sw',
    'warm',
    'prayer_meeting'
  ),
  (
    'Tukio Maalum',
    'Kanisa linawatangazia tukio maalum lijalo. Karibuni kushiriki, kualika wengine na kuwa sehemu ya wakati huu muhimu wa jumuiya yetu.',
    'special_event',
    'announcement',
    'sw',
    'warm',
    'special_event'
  ),
  (
    'Special Event',
    'The church invites everyone to our upcoming special event. Please join us, invite others and be part of this meaningful community moment.',
    'special_event',
    'announcement',
    'en',
    'warm',
    'special_event'
  )
on conflict do nothing;
