create table if not exists public.birthday_announcement_automations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  automation_date date not null,
  automation_key text not null,
  announcement_id uuid references public.announcements(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (church_id, member_id, automation_date),
  unique (automation_key)
);

create index if not exists birthday_announcement_automations_church_date_idx
  on public.birthday_announcement_automations(church_id, automation_date);

with birthday_duplicates as (
  select
    a.id,
    row_number() over (
      partition by a.church_id, m.id, (a.created_at at time zone 'Africa/Nairobi')::date
      order by a.created_at desc, a.id desc
    ) as duplicate_rank
  from public.announcements a
  join public.members m
    on m.church_id = a.church_id
   and a.title = 'Birthday 🎉'
   and a.content = 'Happy Birthday ' || m.full_name || ' 🎉 May God bless you with joy, good health, and many more years.'
)
delete from public.announcements a
using birthday_duplicates d
where a.id = d.id
  and d.duplicate_rank > 1;

insert into public.birthday_announcement_automations (
  church_id,
  member_id,
  automation_date,
  automation_key,
  announcement_id
)
select
  a.church_id,
  m.id,
  (a.created_at at time zone 'Africa/Nairobi')::date,
  'birthday-' || m.id::text || '-' || (a.created_at at time zone 'Africa/Nairobi')::date::text,
  a.id
from public.announcements a
join public.members m
  on m.church_id = a.church_id
 and a.title = 'Birthday 🎉'
 and a.content = 'Happy Birthday ' || m.full_name || ' 🎉 May God bless you with joy, good health, and many more years.'
on conflict (church_id, member_id, automation_date) do update
set announcement_id = excluded.announcement_id;

create or replace function public.ensure_birthday_announcements(
  _church_id uuid,
  _automation_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _target_date date := coalesce(_automation_date, (now() at time zone 'Africa/Nairobi')::date);
  _member record;
  _automation_id uuid;
  _automation_key text;
  _announcement_id uuid;
  _content text;
  _created_count integer := 0;
  _skipped_count integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _church_id is null then
    return jsonb_build_object('success', false, 'error', 'Church is required');
  end if;

  if not (
    public.is_super_admin(auth.uid())
    or public.is_church_admin(auth.uid(), _church_id)
    or exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.church_id = _church_id
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'You are not allowed to run birthday announcements for this church');
  end if;

  for _member in
    select id, full_name, date_of_birth
    from public.members
    where church_id = _church_id
      and status = 'active'
      and date_of_birth is not null
      and extract(month from date_of_birth) = extract(month from _target_date)
      and extract(day from date_of_birth) = extract(day from _target_date)
  loop
    _automation_id := null;
    _announcement_id := null;
    _automation_key := 'birthday-' || _member.id::text || '-' || _target_date::text;
    _content := 'Happy Birthday ' || _member.full_name || ' 🎉 May God bless you with joy, good health, and many more years.';

    select baa.id, baa.announcement_id
    into _automation_id, _announcement_id
    from public.birthday_announcement_automations baa
    where baa.church_id = _church_id
      and baa.member_id = _member.id
      and baa.automation_date = _target_date
    for update;

    if _automation_id is not null and exists (
      select 1
      from public.announcements a
      where a.id = _announcement_id
    ) then
      _skipped_count := _skipped_count + 1;
      continue;
    end if;

    if _automation_id is null then
      select a.id
      into _announcement_id
      from public.announcements a
      where a.church_id = _church_id
        and a.title = 'Birthday 🎉'
        and a.content = _content
        and (a.created_at at time zone 'Africa/Nairobi')::date = _target_date
      order by a.created_at desc, a.id desc
      limit 1;

      if _announcement_id is not null then
        insert into public.birthday_announcement_automations (
          church_id,
          member_id,
          automation_date,
          automation_key,
          announcement_id
        )
        values (
          _church_id,
          _member.id,
          _target_date,
          _automation_key,
          _announcement_id
        )
        on conflict (church_id, member_id, automation_date) do update
        set announcement_id = excluded.announcement_id;

        _skipped_count := _skipped_count + 1;
        continue;
      end if;

      insert into public.birthday_announcement_automations (
        church_id,
        member_id,
        automation_date,
        automation_key
      )
      values (
        _church_id,
        _member.id,
        _target_date,
        _automation_key
      )
      on conflict (church_id, member_id, automation_date) do nothing
      returning id into _automation_id;

      if _automation_id is null then
        _skipped_count := _skipped_count + 1;
        continue;
      end if;
    end if;

    insert into public.announcements (
      church_id,
      title,
      content,
      is_published,
      published_at,
      created_by
    )
    values (
      _church_id,
      'Birthday 🎉',
      _content,
      true,
      now(),
      auth.uid()
    )
    returning id into _announcement_id;

    update public.birthday_announcement_automations
    set announcement_id = _announcement_id
    where id = _automation_id;

    _created_count := _created_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'automation_date', _target_date,
    'birthday_members_count', _created_count + _skipped_count,
    'created_count', _created_count,
    'skipped_count', _skipped_count
  );
end;
$$;

grant execute on function public.ensure_birthday_announcements(uuid, date) to authenticated;
