-- Sacramental Management Platform foundation.
-- Keeps member records as the source of truth while adding sacramental lifecycle data.

create table if not exists public.sacramental_records (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  sacrament_type text not null,
  status text not null default 'planned',
  sacrament_date timestamptz,
  minister text,
  location text,
  certificate_number text,
  register_page text,
  sponsors jsonb not null default '[]'::jsonb,
  witnesses jsonb not null default '[]'::jsonb,
  parents jsonb not null default '{}'::jsonb,
  spouse jsonb not null default '{}'::jsonb,
  preparation jsonb not null default '{}'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  notes text,
  certificate_issued_at timestamptz,
  certificate_ready_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.sacramental_records
  drop constraint if exists sacramental_records_type_check,
  add constraint sacramental_records_type_check
    check (sacrament_type in (
      'baptism',
      'first_communion',
      'confirmation',
      'marriage',
      'holy_orders',
      'anointing',
      'funeral',
      'rcia'
    ));

alter table public.sacramental_records
  drop constraint if exists sacramental_records_status_check,
  add constraint sacramental_records_status_check
    check (status in (
      'planned',
      'preparation',
      'scheduled',
      'completed',
      'certificate_ready',
      'certificate_issued',
      'cancelled',
      'archived'
    ));

create unique index if not exists sacramental_records_certificate_unique
  on public.sacramental_records (church_id, certificate_number)
  where certificate_number is not null;

create index if not exists sacramental_records_church_date_idx
  on public.sacramental_records (church_id, sacrament_date);

create index if not exists sacramental_records_member_idx
  on public.sacramental_records (member_id);

create index if not exists sacramental_records_search_idx
  on public.sacramental_records using gin (
    to_tsvector(
      'simple',
      coalesce(certificate_number, '') || ' ' ||
      coalesce(register_page, '') || ' ' ||
      coalesce(minister, '') || ' ' ||
      coalesce(location, '') || ' ' ||
      coalesce(notes, '')
    )
  );

alter table public.sacramental_records enable row level security;

create or replace function public.can_manage_sacramental_records(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and _church_id is not null
    and (
      public.can_manage_church_roles(_user_id, _church_id)
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.church_id = _church_id
          and lower(ur.role::text) in ('pastor', 'priest', 'secretary', 'church_admin', 'admin')
      )
    );
$$;

drop policy if exists "Sacramental managers can read records" on public.sacramental_records;
create policy "Sacramental managers can read records"
on public.sacramental_records
for select
to authenticated
using (
  public.can_manage_sacramental_records(auth.uid(), church_id)
  or exists (
    select 1
    from public.members m
    where m.id = sacramental_records.member_id
      and m.church_id = sacramental_records.church_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "Sacramental managers can insert records" on public.sacramental_records;
create policy "Sacramental managers can insert records"
on public.sacramental_records
for insert
to authenticated
with check (
  public.can_manage_sacramental_records(auth.uid(), church_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Sacramental managers can update records" on public.sacramental_records;
create policy "Sacramental managers can update records"
on public.sacramental_records
for update
to authenticated
using (public.can_manage_sacramental_records(auth.uid(), church_id))
with check (public.can_manage_sacramental_records(auth.uid(), church_id));

drop policy if exists "Sacramental managers can delete records" on public.sacramental_records;
create policy "Sacramental managers can delete records"
on public.sacramental_records
for delete
to authenticated
using (public.can_manage_sacramental_records(auth.uid(), church_id));

create or replace function public.touch_sacramental_record()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'certificate_ready' and new.certificate_ready_at is null then
    new.certificate_ready_at := now();
  end if;
  if new.status = 'certificate_issued' and new.certificate_issued_at is null then
    new.certificate_issued_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists touch_sacramental_record on public.sacramental_records;
create trigger touch_sacramental_record
before update on public.sacramental_records
for each row
execute function public.touch_sacramental_record();

create or replace function public.get_sacramental_records(_church_id uuid, _search text default null)
returns table (
  id uuid,
  church_id uuid,
  member_id uuid,
  member_name text,
  sacrament_type text,
  status text,
  sacrament_date timestamptz,
  minister text,
  location text,
  certificate_number text,
  register_page text,
  sponsors jsonb,
  witnesses jsonb,
  parents jsonb,
  spouse jsonb,
  preparation jsonb,
  documents jsonb,
  notes text,
  certificate_issued_at timestamptz,
  certificate_ready_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sr.id,
    sr.church_id,
    sr.member_id,
    m.full_name as member_name,
    sr.sacrament_type,
    sr.status,
    sr.sacrament_date,
    sr.minister,
    sr.location,
    sr.certificate_number,
    sr.register_page,
    sr.sponsors,
    sr.witnesses,
    sr.parents,
    sr.spouse,
    sr.preparation,
    sr.documents,
    sr.notes,
    sr.certificate_issued_at,
    sr.certificate_ready_at,
    sr.created_at,
    sr.updated_at,
    sr.archived_at
  from public.sacramental_records sr
  left join public.members m on m.id = sr.member_id
  where sr.church_id = _church_id
    and (
      public.can_manage_sacramental_records(auth.uid(), _church_id)
      or m.user_id = auth.uid()
    )
    and (
      nullif(trim(coalesce(_search, '')), '') is null
      or sr.certificate_number ilike '%' || _search || '%'
      or sr.register_page ilike '%' || _search || '%'
      or sr.minister ilike '%' || _search || '%'
      or sr.location ilike '%' || _search || '%'
      or m.full_name ilike '%' || _search || '%'
      or sr.parents::text ilike '%' || _search || '%'
      or sr.spouse::text ilike '%' || _search || '%'
    )
  order by sr.sacrament_date desc nulls last, sr.created_at desc;
$$;

create or replace function public.save_sacramental_record(
  _record_id uuid,
  _church_id uuid,
  _member_id uuid,
  _sacrament_type text,
  _status text,
  _sacrament_date timestamptz,
  _minister text,
  _location text,
  _certificate_number text,
  _register_page text,
  _sponsors jsonb,
  _witnesses jsonb,
  _parents jsonb,
  _spouse jsonb,
  _preparation jsonb,
  _documents jsonb,
  _notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_sacramental_records(auth.uid(), _church_id) then
    raise exception 'You do not have permission to manage sacramental records for this church' using errcode = '42501';
  end if;

  if _member_id is not null and not exists (
    select 1 from public.members m where m.id = _member_id and m.church_id = _church_id
  ) then
    raise exception 'Selected member does not belong to this church' using errcode = '22023';
  end if;

  if _record_id is null then
    insert into public.sacramental_records (
      church_id, member_id, sacrament_type, status, sacrament_date, minister, location,
      certificate_number, register_page, sponsors, witnesses, parents, spouse, preparation,
      documents, notes, created_by
    )
    values (
      _church_id, _member_id, _sacrament_type, coalesce(_status, 'planned'), _sacrament_date,
      nullif(trim(coalesce(_minister, '')), ''), nullif(trim(coalesce(_location, '')), ''),
      nullif(trim(coalesce(_certificate_number, '')), ''), nullif(trim(coalesce(_register_page, '')), ''),
      coalesce(_sponsors, '[]'::jsonb), coalesce(_witnesses, '[]'::jsonb), coalesce(_parents, '{}'::jsonb),
      coalesce(_spouse, '{}'::jsonb), coalesce(_preparation, '{}'::jsonb), coalesce(_documents, '[]'::jsonb),
      nullif(trim(coalesce(_notes, '')), ''), auth.uid()
    )
    returning id into v_id;
  else
    update public.sacramental_records
    set
      member_id = _member_id,
      sacrament_type = _sacrament_type,
      status = coalesce(_status, 'planned'),
      sacrament_date = _sacrament_date,
      minister = nullif(trim(coalesce(_minister, '')), ''),
      location = nullif(trim(coalesce(_location, '')), ''),
      certificate_number = nullif(trim(coalesce(_certificate_number, '')), ''),
      register_page = nullif(trim(coalesce(_register_page, '')), ''),
      sponsors = coalesce(_sponsors, '[]'::jsonb),
      witnesses = coalesce(_witnesses, '[]'::jsonb),
      parents = coalesce(_parents, '{}'::jsonb),
      spouse = coalesce(_spouse, '{}'::jsonb),
      preparation = coalesce(_preparation, '{}'::jsonb),
      documents = coalesce(_documents, '[]'::jsonb),
      notes = nullif(trim(coalesce(_notes, '')), ''),
      archived_at = case when coalesce(_status, status) = 'archived' then coalesce(archived_at, now()) else null end
    where id = _record_id
      and church_id = _church_id
    returning id into v_id;
  end if;

  if v_id is null then
    raise exception 'Sacramental record was not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

grant execute on function public.can_manage_sacramental_records(uuid, uuid) to authenticated;
grant execute on function public.get_sacramental_records(uuid, text) to authenticated;
grant execute on function public.save_sacramental_record(uuid, uuid, uuid, text, text, timestamptz, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text) to authenticated;
