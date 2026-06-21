-- Add canonical wedding anniversary message template support.
-- Keeps old wedding_anniversary_wish rows compatible while preferring wedding_anniversary.

alter table public.message_templates
  add column if not exists template_type text,
  add column if not exists default_bible_verse text,
  add column if not exists body text,
  add column if not exists content text,
  add column if not exists type text not null default 'announcement',
  add column if not exists category text not null default 'announcement',
  add column if not exists language text not null default 'sw',
  add column if not exists is_active boolean not null default true;

update public.message_templates
set template_type = 'wedding_anniversary'
where template_type = 'wedding_anniversary_wish';

update public.message_templates
set type = 'wedding_anniversary'
where type = 'wedding_anniversary_wish';

create index if not exists idx_message_templates_church_template_type
  on public.message_templates(church_id, template_type);

insert into public.message_templates (
  church_id,
  template_type,
  title,
  body,
  content,
  type,
  category,
  language,
  default_bible_verse,
  is_active
)
select
  null,
  'wedding_anniversary',
  'Wedding Anniversary Wish',
  'Kanisa la {church_name} linawatakia heri ya kumbukumbu ya ndoa, ndugu {member_name} na {spouse_name}.

Tunamshukuru Mungu kwa safari yenu ya ndoa na tunawaombea upendo, umoja, uvumilivu, amani na baraka zaidi katika familia yenu.

Mstari wa kutafakari:
"{bible_verse}"

Mungu aendelee kuibariki ndoa yenu.
— {church_name}',
  'Kanisa la {church_name} linawatakia heri ya kumbukumbu ya ndoa, ndugu {member_name} na {spouse_name}.

Tunamshukuru Mungu kwa safari yenu ya ndoa na tunawaombea upendo, umoja, uvumilivu, amani na baraka zaidi katika familia yenu.

Mstari wa kutafakari:
"{bible_verse}"

Mungu aendelee kuibariki ndoa yenu.
— {church_name}',
  'wedding_anniversary',
  'personal_message',
  'sw',
  'Marko 10:9',
  true
where not exists (
  select 1
  from public.message_templates mt
  where mt.church_id is null
    and mt.template_type = 'wedding_anniversary'
);
