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
    _content := 'Happy Birthday ' || _member.full_name || ' 🎉 May God bless you with joy, good health, and many more years.';

    if exists (
      select 1
      from public.announcements a
      where a.church_id = _church_id
        and a.title = 'Birthday 🎉'
        and a.content = _content
        and (a.created_at at time zone 'Africa/Nairobi')::date = _target_date
    ) then
      _skipped_count := _skipped_count + 1;
    else
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
      );

      _created_count := _created_count + 1;
    end if;
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
