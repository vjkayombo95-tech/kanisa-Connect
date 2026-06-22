-- Custom personal message templates for birthday, anniversary, service recognition,
-- and contribution appreciation WhatsApp sharing.

alter table public.message_templates
  add column if not exists church_id uuid references public.churches(id) on delete cascade,
  add column if not exists template_type text,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists content text,
  add column if not exists default_bible_verse text,
  add column if not exists is_active boolean not null default true,
  add column if not exists type text not null default 'announcement',
  add column if not exists category text not null default 'announcement',
  add column if not exists language text not null default 'sw',
  add column if not exists updated_at timestamptz not null default now();

update public.message_templates
set template_type = type
where template_type is null
  and type in ('birthday_wish', 'wedding_anniversary_wish', 'service_recognition', 'contribution_appreciation');

update public.message_templates
set content = body
where content is null
  and body is not null;

update public.message_templates
set body = content
where body is null
  and content is not null;

create index if not exists idx_message_templates_church_template_type
  on public.message_templates(church_id, template_type);

alter table public.message_templates enable row level security;

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
  seeded.template_type,
  seeded.title,
  seeded.body,
  seeded.body,
  seeded.template_type,
  'personal_message',
  'sw',
  seeded.default_bible_verse,
  true
from (
  values
    (
      'birthday_wish',
      'Birthday Wish',
      'Kanisa la {church_name} tunakutakia sikukuu njema ya kuzaliwa, ndugu {member_name}.

Tunamshukuru Mungu kwa maisha yako na tunakuombea baraka, afya, furaha na amani katika mwaka huu mpya wa maisha yako.

Mstari wa kutafakari:
"{bible_verse}"

Ubarikiwe sana.
- {church_name}',
      'Yeremia 29:11'
    ),
    (
      'wedding_anniversary_wish',
      'Wedding Anniversary Wish',
      'Kanisa la {church_name} linawatakia heri ya kumbukumbu ya ndoa, ndugu {member_name}.

Tunamshukuru Mungu kwa safari yenu ya upendo na tunawaombea umoja, amani na baraka zaidi.

Mstari wa kutafakari:
"{bible_verse}"

Mungu aendelee kuibariki familia yenu.
- {church_name}',
      'Hesabu 6:24-26'
    ),
    (
      'service_recognition',
      'Service Recognition',
      'Kanisa la {church_name} linakushukuru, ndugu {member_name}, kwa huduma yako ya uaminifu.

Tunathamini moyo wako wa kujitoa na tunakuombea nguvu, hekima na furaha katika huduma.

Ubarikiwe sana.
- {church_name}',
      null
    ),
    (
      'contribution_appreciation',
      'Contribution Appreciation',
      'Kanisa la {church_name} linakushukuru, ndugu {member_name}, kwa moyo wako wa ukarimu.

Mchango wako unasaidia kazi ya huduma na kujenga jamii ya imani.

Mungu akubariki sana.
- {church_name}',
      null
    )
) as seeded(template_type, title, body, default_bible_verse)
on conflict do nothing;

grant select, insert, update, delete on public.message_templates to authenticated;
