create or replace function public.save_church_announcement(
  _announcement_id uuid default null,
  _church_id uuid default null,
  _title text default null,
  _content text default null,
  _is_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _target_church_id uuid;
  _announcement_id_result uuid;
  _published_at timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if coalesce(trim(_title), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Title is required');
  end if;

  if coalesce(trim(_content), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Content is required');
  end if;

  _published_at := case when _is_published then now() else null end;

  if _announcement_id is null then
    if _church_id is null then
      return jsonb_build_object('success', false, 'error', 'Church is required');
    end if;

    if not (public.is_church_admin(auth.uid(), _church_id) or public.is_super_admin(auth.uid())) then
      return jsonb_build_object('success', false, 'error', 'You do not have permission to create announcements for this church');
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
      trim(_title),
      trim(_content),
      _is_published,
      _published_at,
      auth.uid()
    )
    returning id into _announcement_id_result;

    return jsonb_build_object('success', true, 'id', _announcement_id_result);
  end if;

  select church_id
  into _target_church_id
  from public.announcements
  where id = _announcement_id;

  if _target_church_id is null then
    return jsonb_build_object('success', false, 'error', 'Announcement not found');
  end if;

  if not (public.is_church_admin(auth.uid(), _target_church_id) or public.is_super_admin(auth.uid())) then
    return jsonb_build_object('success', false, 'error', 'You do not have permission to update this announcement');
  end if;

  update public.announcements
  set title = trim(_title),
      content = trim(_content),
      is_published = _is_published,
      published_at = _published_at,
      archived_at = null,
      updated_at = now()
  where id = _announcement_id;

  return jsonb_build_object('success', true, 'id', _announcement_id);
end;
$$;

create or replace function public.set_church_announcement_archived(
  _announcement_id uuid,
  _archived boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _target_church_id uuid;
  _current public.announcements%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select *
  into _current
  from public.announcements
  where id = _announcement_id;

  if _current.id is null then
    return jsonb_build_object('success', false, 'error', 'Announcement not found');
  end if;

  _target_church_id := _current.church_id;

  if not (public.is_church_admin(auth.uid(), _target_church_id) or public.is_super_admin(auth.uid())) then
    return jsonb_build_object('success', false, 'error', 'You do not have permission to archive this announcement');
  end if;

  update public.announcements
  set archived_at = case when _archived then now() else null end,
      is_published = case when _archived then false else _current.is_published end,
      published_at = case when _archived then null else _current.published_at end,
      updated_at = now()
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
  _target_church_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select church_id
  into _target_church_id
  from public.announcements
  where id = _announcement_id;

  if _target_church_id is null then
    return jsonb_build_object('success', false, 'error', 'Announcement not found');
  end if;

  if not (public.is_church_admin(auth.uid(), _target_church_id) or public.is_super_admin(auth.uid())) then
    return jsonb_build_object('success', false, 'error', 'You do not have permission to delete this announcement');
  end if;

  delete from public.announcements
  where id = _announcement_id;

  return jsonb_build_object('success', true, 'id', _announcement_id);
end;
$$;

grant execute on function public.save_church_announcement(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.set_church_announcement_archived(uuid, boolean) to authenticated;
grant execute on function public.delete_church_announcement(uuid) to authenticated;
