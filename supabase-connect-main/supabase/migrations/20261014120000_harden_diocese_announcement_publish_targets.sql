-- Revalidate selected Diocese announcement parish targets at publish time.
--
-- Draft targets can become stale if a Diocese-parish relationship is ended
-- after the draft is saved. Member delivery already requires an active
-- relationship; publishing must enforce the same boundary before making the
-- announcement visible.

create or replace function public.lock_diocese_announcement_target_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_announcement_id uuid;
begin
  for v_announcement_id in
    select distinct_lock_ids.announcement_id
    from (
      select distinct lock_ids.announcement_id
      from unnest(array[
        case when tg_op in ('UPDATE', 'DELETE') then old.announcement_id else null end,
        case when tg_op in ('INSERT', 'UPDATE') then new.announcement_id else null end
      ]::uuid[]) as lock_ids(announcement_id)
      where lock_ids.announcement_id is not null
    ) distinct_lock_ids
    order by distinct_lock_ids.announcement_id::text
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('diocese_announcement_targets:' || v_announcement_id::text, 0)
    );
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists lock_diocese_announcement_target_mutation_before_write
on public.diocese_announcement_parish_targets;

create trigger lock_diocese_announcement_target_mutation_before_write
before insert or update or delete on public.diocese_announcement_parish_targets
for each row execute function public.lock_diocese_announcement_target_mutation();

create or replace function public.save_diocese_announcement(
  _diocese_id uuid,
  _announcement_id uuid,
  _title text,
  _content text,
  _status text,
  _target_mode text,
  _target_church_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_announcement_id uuid;
  v_title text := btrim(coalesce(_title, ''));
  v_content text := btrim(coalesce(_content, ''));
  v_status text := lower(btrim(coalesce(_status, 'draft')));
  v_target_mode text := lower(btrim(coalesce(_target_mode, 'all_parishes')));
  v_target_ids uuid[] := coalesce(_target_church_ids, '{}'::uuid[]);
  v_invalid_count integer;
begin
  if not public.current_user_can_manage_diocese(_diocese_id) then
    raise exception 'Not authorized to manage this Diocese'
      using errcode = '42501';
  end if;

  if _announcement_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('diocese_announcement_targets:' || _announcement_id::text, 0)
    );
  end if;

  if v_title = '' then
    raise exception 'Announcement title is required'
      using errcode = '22023';
  end if;

  if v_content = '' then
    raise exception 'Announcement content is required'
      using errcode = '22023';
  end if;

  if v_status not in ('draft', 'published') then
    raise exception 'Invalid Diocese announcement status'
      using errcode = '22023';
  end if;

  if v_target_mode not in ('all_parishes', 'selected_parishes') then
    raise exception 'Invalid Diocese announcement target mode'
      using errcode = '22023';
  end if;

  if v_target_mode = 'selected_parishes' and cardinality(v_target_ids) = 0 then
    raise exception 'At least one active parish target is required'
      using errcode = '22023';
  end if;

  if v_target_mode = 'all_parishes' then
    v_target_ids := '{}'::uuid[];
  end if;

  if v_target_mode = 'selected_parishes' then
    select count(*)
      into v_invalid_count
    from unnest(v_target_ids) as supplied(church_id)
    where supplied.church_id is null
       or not exists (
         select 1
         from public.diocese_churches dc
         where dc.diocese_id = _diocese_id
           and dc.church_id = supplied.church_id
           and dc.status = 'active'
       );

    if v_invalid_count > 0 then
      raise exception 'All selected parishes must be active in this Diocese'
        using errcode = '42501';
    end if;
  end if;

  if _announcement_id is null then
    insert into public.diocese_announcements (
      diocese_id,
      title,
      content,
      status,
      target_mode,
      published_at,
      archived_at,
      created_by,
      updated_by
    )
    values (
      _diocese_id,
      v_title,
      v_content,
      v_status,
      v_target_mode,
      case when v_status = 'published' then now() else null end,
      null,
      auth.uid(),
      auth.uid()
    )
    returning id into v_announcement_id;

    perform pg_advisory_xact_lock(
      hashtextextended('diocese_announcement_targets:' || v_announcement_id::text, 0)
    );
  else
    if exists (
      select 1
      from public.diocese_announcements da
      where da.id = _announcement_id
        and da.diocese_id = _diocese_id
        and da.status = 'archived'
    ) then
      raise exception 'Archived Diocese announcements cannot be edited'
        using errcode = '42501';
    end if;

    update public.diocese_announcements da
    set title = v_title,
        content = v_content,
        status = v_status,
        target_mode = v_target_mode,
        published_at = case
          when v_status = 'published' then coalesce(da.published_at, now())
          else null
        end,
        archived_at = null,
        updated_by = auth.uid()
    where da.id = _announcement_id
      and da.diocese_id = _diocese_id
      and da.status <> 'archived'
    returning da.id into v_announcement_id;

    if v_announcement_id is null then
      raise exception 'Diocese announcement not found'
        using errcode = 'P0002';
    end if;
  end if;

  delete from public.diocese_announcement_parish_targets
  where announcement_id = v_announcement_id;

  if v_target_mode = 'selected_parishes' then
    insert into public.diocese_announcement_parish_targets (
      announcement_id,
      diocese_id,
      church_id
    )
    select distinct
      v_announcement_id,
      _diocese_id,
      supplied.church_id
    from unnest(v_target_ids) as supplied(church_id);
  end if;

  return jsonb_build_object(
    'id', v_announcement_id,
    'diocese_id', _diocese_id,
    'status', v_status,
    'target_mode', v_target_mode
  );
end;
$$;

create or replace function public.publish_diocese_announcement(
  _diocese_id uuid,
  _announcement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_announcement record;
  v_target_count integer;
  v_invalid_target_count integer;
  v_announcement_id uuid;
begin
  if not public.current_user_can_manage_diocese(_diocese_id) then
    raise exception 'Not authorized to manage this Diocese'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('diocese_announcement_targets:' || _announcement_id::text, 0)
  );

  select da.id, da.status, da.target_mode
    into v_announcement
  from public.diocese_announcements da
  where da.id = _announcement_id
    and da.diocese_id = _diocese_id
  for update;

  if v_announcement.id is null or v_announcement.status = 'archived' then
    raise exception 'Diocese announcement not found or archived'
      using errcode = 'P0002';
  end if;

  if v_announcement.target_mode = 'selected_parishes' then
    -- Keep lock acquisition deterministic across target rows before checking
    -- the active Diocese-parish relationship rows. save_diocese_announcement
    -- acquires this announcement's advisory lock before parent-row changes, so
    -- concurrent saves and publishes serialize before row-level locks.
    perform 1
    from (
      select dat.id
      from public.diocese_announcement_parish_targets dat
      where dat.announcement_id = _announcement_id
        and dat.diocese_id = _diocese_id
      order by dat.church_id asc, dat.id asc
      for update of dat
    ) locked_targets;

    select count(*)
      into v_target_count
    from public.diocese_announcement_parish_targets dat
    where dat.announcement_id = _announcement_id
      and dat.diocese_id = _diocese_id;

    if v_target_count = 0 then
      raise exception 'At least one active parish target is required'
        using errcode = '22023';
    end if;

    -- Lock active relationship rows in the same deterministic church/id order.
    -- A concurrent unlink/update of any selected active parish must wait until
    -- this transaction either publishes or rejects the announcement.
    with locked_diocese_churches as (
      select dc.id, dc.church_id
      from public.diocese_churches dc
      join public.diocese_announcement_parish_targets dat
        on dat.diocese_id = _diocese_id
       and dat.church_id = dc.church_id
      where dat.announcement_id = _announcement_id
        and dc.diocese_id = _diocese_id
        and dc.status = 'active'
      order by dc.church_id asc, dc.id asc
      for update of dc
    )
    select count(*)
      into v_invalid_target_count
    from public.diocese_announcement_parish_targets dat
    left join locked_diocese_churches dc
      on dc.church_id = dat.church_id
    where dat.announcement_id = _announcement_id
      and dat.diocese_id = _diocese_id
      and dc.id is null;

    if v_invalid_target_count > 0 then
      raise exception 'All selected parishes must be active in this Diocese'
        using errcode = '42501';
    end if;
  end if;

  update public.diocese_announcements
  set status = 'published',
      published_at = coalesce(published_at, now()),
      archived_at = null,
      updated_by = auth.uid()
  where id = _announcement_id
    and diocese_id = _diocese_id
    and status <> 'archived'
  returning id into v_announcement_id;

  if v_announcement_id is null then
    raise exception 'Diocese announcement not found or archived'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', v_announcement_id, 'status', 'published');
end;
$$;

comment on function public.publish_diocese_announcement(uuid, uuid) is
  'Publishes Diocese announcements after caller-bound Diocese management authorization and active selected-parish target revalidation.';

comment on function public.save_diocese_announcement(uuid, uuid, text, text, text, text, uuid[]) is
  'Creates or updates Diocese announcements using caller-bound Diocese management authorization, per-announcement target synchronization, and active parish target validation.';

comment on function public.lock_diocese_announcement_target_mutation() is
  'Serializes direct Diocese announcement parish target mutations with publication validation per announcement.';

alter function public.lock_diocese_announcement_target_mutation() owner to postgres;
alter function public.save_diocese_announcement(uuid, uuid, text, text, text, text, uuid[]) owner to postgres;
alter function public.publish_diocese_announcement(uuid, uuid) owner to postgres;

revoke all on function public.lock_diocese_announcement_target_mutation()
  from public, anon, authenticated;
revoke all on function public.save_diocese_announcement(uuid, uuid, text, text, text, text, uuid[])
  from public, anon, authenticated;
revoke all on function public.publish_diocese_announcement(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.save_diocese_announcement(uuid, uuid, text, text, text, text, uuid[])
  to authenticated, service_role;
grant execute on function public.publish_diocese_announcement(uuid, uuid)
  to authenticated, service_role;

revoke insert, update, delete on table public.diocese_announcement_parish_targets
  from authenticated;

grant select on table public.diocese_announcement_parish_targets
  to authenticated;
