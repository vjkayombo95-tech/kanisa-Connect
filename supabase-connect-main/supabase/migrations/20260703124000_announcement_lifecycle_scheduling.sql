-- Turn announcements into scheduled communication objects.

alter table public.announcements
  add column if not exists status text not null default 'draft',
  add column if not exists featured boolean not null default false,
  add column if not exists publish_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists timezone text not null default 'Africa/Nairobi',
  add column if not exists never_expires boolean not null default false,
  add column if not exists audience text[] not null default array['everyone']::text[],
  add column if not exists target_ministry text,
  add column if not exists target_community text,
  add column if not exists show_on_calendar boolean not null default false,
  add column if not exists notification_strategy text not null default 'none',
  add column if not exists category text not null default 'general',
  add column if not exists lifecycle_metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.announcements
  drop constraint if exists announcements_status_check,
  add constraint announcements_status_check
    check (status in ('draft', 'scheduled', 'active', 'featured', 'expired', 'archived'));

alter table public.announcements
  drop constraint if exists announcements_notification_strategy_check,
  add constraint announcements_notification_strategy_check
    check (notification_strategy in ('none', 'immediate', 'on_publish', 'one_day_before_expiry'));

create or replace function public.resolve_announcement_status(
  _is_published boolean,
  _archived_at timestamptz,
  _featured boolean,
  _publish_at timestamptz,
  _expires_at timestamptz,
  _never_expires boolean
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when _archived_at is not null then 'archived'
    when coalesce(_never_expires, false) = false
      and _expires_at is not null
      and _expires_at <= now() then 'expired'
    when coalesce(_is_published, false) = false
      and _publish_at is not null
      and _publish_at > now() then 'scheduled'
    when coalesce(_is_published, false) = true
      and coalesce(_featured, false) = true then 'featured'
    when coalesce(_is_published, false) = true then 'active'
    else 'draft'
  end;
$$;

create or replace function public.sync_announcement_lifecycle_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.publish_at is null and new.is_published then
    new.publish_at := coalesce(new.published_at, now());
  end if;

  if new.published_at is null and new.is_published then
    new.published_at := coalesce(new.publish_at, now());
  end if;

  if coalesce(new.never_expires, false) then
    new.expires_at := null;
  end if;

  new.status := public.resolve_announcement_status(
    new.is_published,
    new.archived_at,
    new.featured,
    new.publish_at,
    new.expires_at,
    new.never_expires
  );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_announcement_lifecycle_fields on public.announcements;
create trigger sync_announcement_lifecycle_fields
before insert or update on public.announcements
for each row
execute function public.sync_announcement_lifecycle_fields();

update public.announcements
set
  publish_at = coalesce(publish_at, published_at),
  never_expires = coalesce(never_expires, expires_at is null),
  status = public.resolve_announcement_status(
    is_published,
    archived_at,
    featured,
    coalesce(publish_at, published_at),
    expires_at,
    coalesce(never_expires, expires_at is null)
  );

drop policy if exists "Church managers can update announcements" on public.announcements;
create policy "Church managers can update announcements"
on public.announcements
for update
to authenticated
using (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
)
with check (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
);

drop policy if exists "Church managers can delete announcements" on public.announcements;
create policy "Church managers can delete announcements"
on public.announcements
for delete
to authenticated
using (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
);

create or replace function public.update_announcement_lifecycle(_church_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_published integer := 0;
  v_expired integer := 0;
begin
  update public.announcements a
  set
    is_published = true,
    published_at = coalesce(a.published_at, now()),
    status = case when a.featured then 'featured' else 'active' end
  where a.archived_at is null
    and a.is_published = false
    and a.publish_at is not null
    and a.publish_at <= now()
    and (_church_id is null or a.church_id = _church_id);
  get diagnostics v_published = row_count;

  update public.announcements a
  set
    is_published = false,
    status = 'expired'
  where a.archived_at is null
    and a.never_expires = false
    and a.expires_at is not null
    and a.expires_at <= now()
    and (_church_id is null or a.church_id = _church_id);
  get diagnostics v_expired = row_count;

  return jsonb_build_object('success', true, 'published', v_published, 'expired', v_expired);
end;
$$;

create or replace function public.save_church_announcement(
  _announcement_id uuid,
  _church_id uuid,
  _title text,
  _content text,
  _is_published boolean default false,
  _publish_at timestamptz default null,
  _expires_at timestamptz default null,
  _timezone text default 'Africa/Nairobi',
  _never_expires boolean default false,
  _audience text[] default array['everyone']::text[],
  _target_ministry text default null,
  _target_community text default null,
  _show_on_calendar boolean default false,
  _notification_strategy text default 'none',
  _category text default 'general',
  _featured boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_publish_at timestamptz := _publish_at;
  v_is_published boolean := coalesce(_is_published, false);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if _church_id is null or nullif(trim(coalesce(_title, '')), '') is null or nullif(trim(coalesce(_content, '')), '') is null then
    raise exception 'Missing announcement fields' using errcode = '22023';
  end if;

  if not public.can_manage_church_roles(auth.uid(), _church_id) then
    raise exception 'You do not have permission to manage announcements for this church' using errcode = '42501';
  end if;

  if v_is_published and v_publish_at is null then
    v_publish_at := now();
  end if;

  if _announcement_id is null then
    insert into public.announcements (
      church_id,
      title,
      content,
      is_published,
      published_at,
      created_by,
      publish_at,
      expires_at,
      timezone,
      never_expires,
      audience,
      target_ministry,
      target_community,
      show_on_calendar,
      notification_strategy,
      category,
      featured
    )
    values (
      _church_id,
      trim(_title),
      trim(_content),
      v_is_published,
      case when v_is_published then v_publish_at else null end,
      auth.uid(),
      v_publish_at,
      case when coalesce(_never_expires, false) then null else _expires_at end,
      coalesce(nullif(trim(_timezone), ''), 'Africa/Nairobi'),
      coalesce(_never_expires, false),
      coalesce(_audience, array['everyone']::text[]),
      nullif(trim(coalesce(_target_ministry, '')), ''),
      nullif(trim(coalesce(_target_community, '')), ''),
      coalesce(_show_on_calendar, false),
      coalesce(nullif(trim(_notification_strategy), ''), 'none'),
      coalesce(nullif(trim(_category), ''), 'general'),
      coalesce(_featured, false)
    )
    returning id into v_id;
  else
    update public.announcements
    set
      title = trim(_title),
      content = trim(_content),
      is_published = v_is_published,
      published_at = case when v_is_published then coalesce(published_at, v_publish_at, now()) else null end,
      archived_at = null,
      publish_at = v_publish_at,
      expires_at = case when coalesce(_never_expires, false) then null else _expires_at end,
      timezone = coalesce(nullif(trim(_timezone), ''), 'Africa/Nairobi'),
      never_expires = coalesce(_never_expires, false),
      audience = coalesce(_audience, array['everyone']::text[]),
      target_ministry = nullif(trim(coalesce(_target_ministry, '')), ''),
      target_community = nullif(trim(coalesce(_target_community, '')), ''),
      show_on_calendar = coalesce(_show_on_calendar, false),
      notification_strategy = coalesce(nullif(trim(_notification_strategy), ''), 'none'),
      category = coalesce(nullif(trim(_category), ''), 'general'),
      featured = coalesce(_featured, false)
    where id = _announcement_id
      and church_id = _church_id
    returning id into v_id;
  end if;

  if v_id is null then
    raise exception 'Announcement was not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

create or replace function public.set_church_announcement_archived(_announcement_id uuid, _archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.announcements%rowtype;
begin
  select * into v_row
  from public.announcements
  where id = _announcement_id
  for update;

  if v_row.id is null then
    raise exception 'Announcement was not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_church_roles(auth.uid(), v_row.church_id) then
    raise exception 'You do not have permission to manage announcements for this church' using errcode = '42501';
  end if;

  update public.announcements
  set
    archived_at = case when _archived then now() else null end,
    is_published = case when _archived then false else is_published end,
    published_at = case when _archived then null else published_at end
  where id = _announcement_id;

  return jsonb_build_object('success', true, 'id', _announcement_id);
end;
$$;

create or replace function public.delete_church_announcement(_announcement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.announcements%rowtype;
begin
  select * into v_row
  from public.announcements
  where id = _announcement_id
  for update;

  if v_row.id is null then
    raise exception 'Announcement was not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_church_roles(auth.uid(), v_row.church_id) then
    raise exception 'You do not have permission to manage announcements for this church' using errcode = '42501';
  end if;

  delete from public.announcements where id = _announcement_id;
  return jsonb_build_object('success', true, 'id', _announcement_id);
end;
$$;

drop function if exists public.get_portal_announcements(uuid, integer);

create function public.get_portal_announcements(_church_id uuid, _limit integer default 50)
returns table (
  id uuid,
  church_id uuid,
  title text,
  content text,
  is_published boolean,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz,
  status text,
  featured boolean,
  publish_at timestamptz,
  expires_at timestamptz,
  audience text[],
  category text,
  show_on_calendar boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.update_announcement_lifecycle(_church_id);

  return query
  select
    a.id,
    a.church_id,
    a.title,
    a.content,
    a.is_published,
    a.published_at,
    a.created_by,
    a.created_at,
    a.updated_at,
    a.archived_at,
    a.status,
    a.featured,
    a.publish_at,
    a.expires_at,
    a.audience,
    a.category,
    a.show_on_calendar
  from public.announcements a
  where a.church_id = _church_id
    and a.archived_at is null
    and a.is_published = true
    and a.status in ('active', 'featured')
    and (a.publish_at is null or a.publish_at <= now())
    and (a.never_expires = true or a.expires_at is null or a.expires_at > now())
    and (
      'everyone' = any(a.audience)
      or 'members' = any(a.audience)
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.church_id = a.church_id
          and lower(ur.role::text) = any(a.audience)
      )
    )
  order by a.featured desc, coalesce(a.publish_at, a.published_at, a.created_at) desc
  limit greatest(coalesce(_limit, 50), 1);
end;
$$;

grant execute on function public.resolve_announcement_status(boolean, timestamptz, boolean, timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.update_announcement_lifecycle(uuid) to authenticated;
grant execute on function public.save_church_announcement(uuid, uuid, text, text, boolean, timestamptz, timestamptz, text, boolean, text[], text, text, boolean, text, text, boolean) to authenticated;
grant execute on function public.set_church_announcement_archived(uuid, boolean) to authenticated;
grant execute on function public.delete_church_announcement(uuid) to authenticated;
grant execute on function public.get_portal_announcements(uuid, integer) to authenticated;
