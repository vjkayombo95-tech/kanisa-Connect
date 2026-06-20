-- Keep optional billing initialization from blocking creation of a church workspace.
create or replace function public.ensure_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.subscriptions (church_id, plan, status)
    values (new.id, 'free', 'active')
    on conflict do nothing;
  exception
    when others then
      raise warning 'Unable to initialize optional billing subscription for church %: %', new.id, sqlerrm;
  end;

  return new;
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
  _church public.churches%rowtype;
  _free_plan_id uuid;
begin
  if _user_id is null then
    raise exception 'Your session is no longer valid. Please sign in again.';
  end if;

  if nullif(trim(_name), '') is null then
    raise exception 'Church name is required.';
  end if;

  begin
    insert into public.churches (name, email, phone, address, created_by)
    values (
      trim(_name),
      nullif(trim(_email), ''),
      nullif(trim(_phone), ''),
      nullif(trim(_address), ''),
      _user_id
    )
    returning * into _church;
  exception
    when others then
      raise exception 'Unable to create the church record: %', sqlerrm;
  end;

  begin
    insert into public.user_roles (user_id, church_id, role)
    values (_user_id, _church.id, 'church_admin');

    insert into public.members (church_id, user_id, full_name, email, phone)
    values (
      _church.id,
      _user_id,
      coalesce(nullif(trim(_owner_name), ''), nullif(trim(_email), ''), 'Admin'),
      nullif(trim(_email), ''),
      nullif(trim(_phone), '')
    );
  exception
    when others then
      raise exception 'Unable to create the church administrator profile: %', sqlerrm;
  end;

  begin
    insert into public.contribution_categories (church_id, name, description, is_special)
    values
      (_church.id, 'Tithe', 'Regular tithe', false),
      (_church.id, 'Offering', 'General offering', false),
      (_church.id, 'Building Fund', 'Church building fund', true),
      (_church.id, 'Donations', 'General donations', false);
  exception
    when others then
      raise warning 'Unable to initialize optional contribution categories for church %: %', _church.id, sqlerrm;
  end;

  begin
    select id
    into _free_plan_id
    from public.subscription_plans
    where name = 'free'
    limit 1;

    if _free_plan_id is not null then
      insert into public.church_subscriptions (
        church_id,
        plan_id,
        status,
        current_period_end
      )
      values (
        _church.id,
        _free_plan_id,
        'active',
        now() + interval '30 days'
      );
    end if;
  exception
    when others then
      raise warning 'Unable to initialize optional legacy subscription for church %: %', _church.id, sqlerrm;
  end;

  return jsonb_build_object(
    'id', _church.id,
    'code', _church.code,
    'name', _church.name
  );
end;
$$;

revoke all on function public.create_church_workspace(text, text, text, text, text) from public;
grant execute on function public.create_church_workspace(text, text, text, text, text) to authenticated;
