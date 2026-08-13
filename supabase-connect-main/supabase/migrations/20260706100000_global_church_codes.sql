-- Global public church codes for human-readable church identity.
-- UUIDs remain the internal primary identifiers and foreign-key targets.

alter table public.churches
  add column if not exists church_code text,
  add column if not exists short_code text,
  add column if not exists code_generated_at timestamptz;

create or replace function public.church_code_token(value text, fallback text default 'PAR')
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      substring(
        regexp_replace(upper(coalesce(value, '')), '[^A-Z0-9]', '', 'g')
        from 1 for 3
      ),
      ''
    ),
    fallback
  );
$$;

create or replace function public.generate_church_code(
  _church_name text default null,
  _address text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_region text := public.church_code_token(_address, 'PAR');
  v_name text := public.church_code_token(_church_name, 'CHR');
  v_prefix text;
  v_candidate text;
  v_sequence integer := 1;
begin
  v_prefix := format('KC-%s-%s', v_region, v_name);

  loop
    v_candidate := format('%s-%s', v_prefix, lpad(v_sequence::text, 3, '0'));
    exit when not exists (
      select 1
      from public.churches c
      where upper(c.church_code) = v_candidate
    );
    v_sequence := v_sequence + 1;
  end loop;

  return v_candidate;
end;
$$;

create or replace function public.generate_church_join_code(
  _church_name text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := public.church_code_token(_church_name, 'PAR');
  v_candidate text;
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_candidate := format('%s%s', v_prefix, lpad(floor(random() * 10000)::int::text, 4, '0'));
    exit when not exists (
      select 1
      from public.churches c
      where upper(c.short_code) = v_candidate
    );
    if v_attempt > 200 then
      v_prefix := public.church_code_token(_church_name, 'PAR') || substring(md5(random()::text) from 1 for 1);
    end if;
  end loop;

  return v_candidate;
end;
$$;

create or replace function public.set_church_public_codes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('kanisa-connect-church-code-generation'));

  if nullif(trim(coalesce(new.church_code, '')), '') is null then
    new.church_code := public.generate_church_code(new.name, new.address);
  else
    new.church_code := upper(trim(new.church_code));
  end if;

  if nullif(trim(coalesce(new.short_code, '')), '') is null then
    new.short_code := public.generate_church_join_code(new.name);
  else
    new.short_code := upper(regexp_replace(trim(new.short_code), '[^A-Za-z0-9]', '', 'g'));
  end if;

  if new.code_generated_at is null then
    new.code_generated_at := now();
  end if;

  return new;
end;
$$;

do $$
declare
  v_church record;
begin
  for v_church in
    select id, name, address, church_code, short_code, code_generated_at
    from public.churches
    where nullif(trim(coalesce(church_code, '')), '') is null
       or nullif(trim(coalesce(short_code, '')), '') is null
    order by created_at, id
  loop
    update public.churches c
    set
      church_code = coalesce(nullif(trim(v_church.church_code), ''), public.generate_church_code(v_church.name, v_church.address)),
      short_code = coalesce(nullif(trim(v_church.short_code), ''), public.generate_church_join_code(v_church.name)),
      code_generated_at = coalesce(v_church.code_generated_at, now())
    where c.id = v_church.id;
  end loop;
end;
$$;

alter table public.churches
  alter column church_code set not null;

alter table public.churches
  drop constraint if exists churches_church_code_format_check,
  add constraint churches_church_code_format_check
    check (church_code ~ '^KC-[A-Z0-9]{3}-[A-Z0-9]{3}-[0-9]{3,}$'),
  drop constraint if exists churches_short_code_format_check,
    add constraint churches_short_code_format_check
    check (short_code is null or short_code ~ '^[A-Z0-9]{6,12}$');

alter table public.churches
  drop constraint if exists churches_church_code_key,
  add constraint churches_church_code_key unique (church_code),
  drop constraint if exists churches_short_code_key,
  add constraint churches_short_code_key unique (short_code);

create unique index if not exists churches_church_code_unique_idx
  on public.churches (upper(church_code));

create unique index if not exists churches_short_code_unique_idx
  on public.churches (upper(short_code))
  where short_code is not null;

drop trigger if exists set_church_public_codes_before_write on public.churches;
create trigger set_church_public_codes_before_write
before insert or update of name, address, church_code, short_code
on public.churches
for each row
execute function public.set_church_public_codes();

drop function if exists public.get_public_join_church(text);
create or replace function public.get_public_join_church(_slug text)
returns table(id uuid, name text, code text, church_code text, short_code text, slug text, logo_url text, metadata jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _has_metadata boolean;
  _has_logo_url boolean;
  _has_status boolean;
  _metadata_expression text;
  _logo_expression text;
  _status_condition text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'churches' and column_name = 'metadata'
  ) into _has_metadata;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'churches' and column_name = 'logo_url'
  ) into _has_logo_url;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'churches' and column_name = 'status'
  ) into _has_status;

  _metadata_expression := case when _has_metadata then 'coalesce(c.metadata, ''{}''::jsonb)' else '''{}''::jsonb' end;
  _logo_expression := case when _has_logo_url then 'c.logo_url' else 'null::text' end;
  _status_condition := case when _has_status then 'and c.status = ''active''' else '' end;

  return query execute format(
    'select c.id, c.name, c.code, c.church_code, c.short_code, c.slug, %s, %s
     from public.churches c
     where (
       lower(c.slug) = lower(trim($1))
       or upper(c.church_code) = upper(trim($1))
       or upper(c.short_code) = upper(regexp_replace(trim($1), ''[^A-Za-z0-9]'', '''', ''g''))
       or upper(coalesce(c.code, '''')) = upper(trim($1))
     )
     %s
     limit 1',
    _logo_expression,
    _metadata_expression,
    _status_condition
  )
  using _slug;
end;
$$;

drop function if exists public.get_public_registration_church(text, uuid);
create or replace function public.get_public_registration_church(
  _church_code text default null,
  _church_id uuid default null
)
returns table(id uuid, name text, code text, church_code text, short_code text, metadata jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  has_metadata_column boolean;
  v_code text := nullif(trim(coalesce(_church_code, '')), '');
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'churches' and column_name = 'metadata'
  ) into has_metadata_column;

  return query execute format(
    'select c.id, c.name, c.code, c.church_code, c.short_code, %s as metadata
     from public.churches c
     where (
       $1 is not null
       and (
         upper(c.church_code) = upper($1)
         or upper(c.short_code) = upper(regexp_replace($1, ''[^A-Za-z0-9]'', '''', ''g''))
         or upper(coalesce(c.code, '''')) = upper($1)
         or c.name ilike $1
       )
     )
     or ($2 is not null and c.id = $2)
     order by case when upper(c.short_code) = upper(regexp_replace(coalesce($1, ''''), ''[^A-Za-z0-9]'', '''', ''g'')) then 0 else 1 end
     limit 1',
    case when has_metadata_column then 'coalesce(c.metadata, ''{}''::jsonb)' else 'null::jsonb' end
  )
  using v_code, _church_id;
end;
$$;

create or replace function public.create_church_workspace(
  _name text,
  _email text default null,
  _phone text default null,
  _address text default null,
  _owner_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _owner_email text;
  _church public.churches%rowtype;
  _free_plan_id uuid;
begin
  if _user_id is null then
    raise exception 'Your session is no longer valid. Please sign in again.';
  end if;

  if nullif(trim(_name), '') is null then
    raise exception 'Church name is required.';
  end if;

  select email into _owner_email from auth.users where id = _user_id;
  _owner_email := nullif(lower(trim(coalesce(_owner_email, auth.jwt() ->> 'email', ''))), '');

  begin
    insert into public.churches (name, email, phone, address, created_by)
    values (trim(_name), nullif(trim(_email), ''), nullif(trim(_phone), ''), nullif(trim(_address), ''), _user_id)
    returning * into _church;
  exception when others then
    raise exception 'Unable to create the church record: %', sqlerrm;
  end;

  begin
    insert into public.user_roles (user_id, church_id, role)
    values (_user_id, _church.id, 'church_admin');

    insert into public.members (church_id, user_id, full_name, email, phone)
    values (_church.id, _user_id, coalesce(nullif(trim(_owner_name), ''), _owner_email, 'Admin'), _owner_email, nullif(trim(_phone), ''));
  exception when others then
    raise exception 'Unable to create the church administrator profile: %', sqlerrm;
  end;

  begin
    insert into public.contribution_categories (church_id, name, description, is_special)
    values
      (_church.id, 'Tithe', 'Regular tithe', false),
      (_church.id, 'Offering', 'General offering', false),
      (_church.id, 'Building Fund', 'Church building fund', true),
      (_church.id, 'Donations', 'General donations', false);
  exception when others then
    raise warning 'Unable to initialize optional contribution categories for church %: %', _church.id, sqlerrm;
  end;

  begin
    select id into _free_plan_id from public.subscription_plans where name = 'free' limit 1;
    if _free_plan_id is not null then
      insert into public.church_subscriptions (church_id, plan_id, status, current_period_end)
      values (_church.id, _free_plan_id, 'active', now() + interval '30 days');
    end if;
  exception when others then
    raise warning 'Unable to initialize optional legacy subscription for church %: %', _church.id, sqlerrm;
  end;

  return jsonb_build_object(
    'id', _church.id,
    'code', _church.code,
    'church_code', _church.church_code,
    'short_code', _church.short_code,
    'name', _church.name
  );
end;
$$;

revoke all on function public.generate_church_code(text, text) from public;
revoke all on function public.generate_church_join_code(text) from public;
revoke all on function public.church_code_token(text, text) from public;

grant execute on function public.generate_church_code(text, text) to authenticated;
grant execute on function public.generate_church_join_code(text) to authenticated;
grant execute on function public.get_public_join_church(text) to anon, authenticated;
grant execute on function public.get_public_registration_church(text, uuid) to anon, authenticated;
grant execute on function public.create_church_workspace(text, text, text, text, text) to authenticated;
