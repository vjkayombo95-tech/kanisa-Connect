create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('service', 'youth', 'prayer', 'event')),
  language text not null check (language in ('sw', 'en')),
  title text,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  title text not null,
  content text not null check (char_length(trim(content)) > 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'scheduled')),
  language text default 'sw' check (language in ('sw', 'en')),
  type text check (type in ('service', 'youth', 'prayer', 'event')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_message_templates_type_language
  on public.message_templates(type, language);

create index if not exists idx_messages_church_id_created_at
  on public.messages(church_id, created_at desc);

drop trigger if exists update_message_templates_updated_at on public.message_templates;
drop trigger if exists update_messages_updated_at on public.messages;

create trigger update_message_templates_updated_at
before update on public.message_templates
for each row
execute function public.update_updated_at_column();

create trigger update_messages_updated_at
before update on public.messages
for each row
execute function public.update_updated_at_column();

alter table public.message_templates enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Authenticated users can view message templates" on public.message_templates;
drop policy if exists "Church admins can manage message templates" on public.message_templates;
drop policy if exists "Church members can view sent messages" on public.messages;
drop policy if exists "Church admins can create messages" on public.messages;
drop policy if exists "Church admins can update messages" on public.messages;
drop policy if exists "Church admins can delete messages" on public.messages;

create policy "Authenticated users can view message templates"
on public.message_templates
for select
using (auth.uid() is not null);

create policy "Church admins can manage message templates"
on public.message_templates
for all
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

create policy "Church members can view sent messages"
on public.messages
for select
using (
  public.is_church_member(auth.uid(), church_id)
  and status = 'sent'
);

create policy "Church admins can create messages"
on public.messages
for insert
with check (
  created_by = auth.uid()
  and church_id in (
    select ur.church_id
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
  )
);

create policy "Church admins can update messages"
on public.messages
for update
using (
  church_id in (
    select ur.church_id
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
  )
)
with check (
  church_id in (
    select ur.church_id
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
  )
);

create policy "Church admins can delete messages"
on public.messages
for delete
using (
  church_id in (
    select ur.church_id
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer')
  )
);

insert into public.message_templates (type, language, title, content)
select seeded.type, seeded.language, seeded.title, seeded.content
from (
  values
    ('service', 'sw', 'Tangazo la Ibada ya Jumapili', 'Karibuni kwenye ibada yetu ya Jumapili hii kuanzia saa 2:00 asubuhi. Tutakuwa na muda wa maombi, sifa na neno la Mungu. Tafadhali fika mapema na umkaribishe jirani yako.'),
    ('service', 'sw', 'Ibada ya Jumapili Wiki Hii', 'Kanisa linawakaribisha waumini wote kwenye ibada ya Jumapili hii. Njoo tushirikiane katika kuabudu, kusikiliza neno la Mungu na kuombeana kama familia ya imani.'),
    ('service', 'sw', 'Tusikose Ibada ya Jumapili', 'Tunawakumbusha waumini wote kuhusu ibada ya Jumapili ijayo. Huu ni wakati wa kujengwa kiroho, kuungana na wengine na kumtukuza Mungu pamoja.'),
    ('service', 'en', 'Sunday Service Announcement', 'Join us this Sunday for a powerful worship service starting at 8:00 AM. Expect prayer, praise, and a timely word for the church family. Come early and invite someone.'),
    ('service', 'en', 'This Week''s Sunday Service', 'You are warmly invited to our Sunday service this week. Let us gather in faith, worship together, and receive encouragement from the Word of God.'),
    ('service', 'en', 'Do Not Miss Sunday Service', 'We are reminding the church family about the upcoming Sunday service. It will be a meaningful time of worship, fellowship, and spiritual renewal.'),
    ('youth', 'sw', 'Tangazo la Mkutano wa Vijana', 'Vijana wote mnakaribishwa kwenye mkutano wa vijana Ijumaa hii jioni. Tutakuwa na neno, maombi, mjadala na muda wa kujengana katika imani.'),
    ('youth', 'sw', 'Kikao cha Vijana Wiki Hii', 'Tunawakumbusha vijana wote kuhusu mkutano wetu wa wiki hii. Njoo tushirikiane, tujifunze pamoja, na kuimarishana kiroho.'),
    ('youth', 'sw', 'Karibu Mkutano wa Vijana', 'Mkutano wa vijana unafanyika wiki hii na kila kijana anakaribishwa. Leta rafiki yako na tuwe na muda mzuri wa ibada, neno na ushirika.'),
    ('youth', 'en', 'Youth Meeting Announcement', 'All young people are invited to this week''s youth meeting. We will have worship, a short teaching, prayer, and time to connect as a growing faith community.'),
    ('youth', 'en', 'Youth Fellowship This Week', 'Please join us for our youth fellowship this week. It will be a refreshing space for encouragement, discipleship, and real connection.'),
    ('youth', 'en', 'Join the Youth Gathering', 'The youth gathering is happening this week and everyone is welcome. Bring a friend and come ready for worship, learning, and fellowship.'),
    ('prayer', 'sw', 'Tangazo la Mkutano wa Maombi', 'Karibu kwenye mkutano wa maombi utakaofanyika Jumatano jioni. Tutatafuta uso wa Mungu pamoja na kuombea familia, kanisa na taifa letu.'),
    ('prayer', 'sw', 'Muda wa Maombi ya Kanisa', 'Tunawakumbusha waumini wote kuhusu mkutano wa maombi wa wiki hii. Njoo tushirikiane katika maombi na kuimarisha maisha yetu ya kiroho.'),
    ('prayer', 'sw', 'Tusimame Pamoja Katika Maombi', 'Kanisa linakaribisha waumini wote kwenye mkutano wa maombi. Huu ni wakati wa kuleta mahitaji yetu mbele za Mungu na kuombeana kwa upendo.'),
    ('prayer', 'en', 'Prayer Meeting Announcement', 'You are invited to our church prayer meeting this week. Let us seek God together and lift up our families, church, and community in prayer.'),
    ('prayer', 'en', 'Church Prayer Gathering', 'Please join us for a special time of prayer this week. We will gather to intercede, encourage one another, and grow deeper in faith.'),
    ('prayer', 'en', 'Stand With Us in Prayer', 'Our prayer meeting is coming up this week. Come ready to pray, believe, and stand together for the needs of the church and community.'),
    ('event', 'sw', 'Tangazo la Tukio Maalum', 'Tunayo furaha kuwatangazia tukio maalum litakalofanyika hivi karibuni kanisani. Tafadhali jiandae kushiriki nasi katika siku hii ya pekee na uendelee kufuatilia taarifa zaidi.'),
    ('event', 'sw', 'Karibu Tukio Maalum la Kanisa', 'Kanisa linakualika kwenye tukio maalum linalokuja. Hii itakuwa nafasi ya baraka, ushirika na shangwe kwa familia yote ya kanisa.'),
    ('event', 'sw', 'Usikose Tukio Hili Maalum', 'Tunawaalika wote kushiriki kwenye tukio maalum la kanisa. Endelea kufuatilia maelezo zaidi na jiandae kuwa sehemu ya siku hii ya kipekee.'),
    ('event', 'en', 'Special Event Announcement', 'We are excited to announce a special church event coming soon. Please prepare to join us for a memorable and uplifting time together.'),
    ('event', 'en', 'You Are Invited to a Special Event', 'Our church family is invited to an upcoming special event. It will be a meaningful opportunity for fellowship, celebration, and encouragement.'),
    ('event', 'en', 'Do Not Miss This Special Event', 'A special event is on the way, and we would love to see you there. Watch for more details and get ready to be part of something memorable.')
) as seeded(type, language, title, content)
where not exists (
  select 1
  from public.message_templates existing
  where existing.type = seeded.type
    and existing.language = seeded.language
    and coalesce(existing.title, '') = coalesce(seeded.title, '')
    and existing.content = seeded.content
);
