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
    raise exception 'You must be signed in to create a church.';
  end if;

  if nullif(trim(_name), '') is null then
    raise exception 'Church name is required.';
  end if;

  insert into public.churches (name, email, phone, address, created_by)
  values (
    trim(_name),
    nullif(trim(_email), ''),
    nullif(trim(_phone), ''),
    nullif(trim(_address), ''),
    _user_id
  )
  returning * into _church;

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

  insert into public.contribution_categories (church_id, name, description, is_special)
  values
    (_church.id, 'Tithe', 'Regular tithe', false),
    (_church.id, 'Offering', 'General offering', false),
    (_church.id, 'Building Fund', 'Church building fund', true),
    (_church.id, 'Donations', 'General donations', false);

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

  return jsonb_build_object(
    'id', _church.id,
    'code', _church.code,
    'name', _church.name
  );
end;
$$;

revoke all on function public.create_church_workspace(text, text, text, text, text) from public;
grant execute on function public.create_church_workspace(text, text, text, text, text) to authenticated;
