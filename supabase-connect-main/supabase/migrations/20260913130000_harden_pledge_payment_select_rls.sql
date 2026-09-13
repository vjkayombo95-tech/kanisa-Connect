-- Wave 15: harden pledge payment financial privacy.
--
-- The remaining "Users can view accessible pledge payments" policy preserves
-- intended access for pledge owners, authorized church admins, and authorized
-- community leaders. The removed policy was broader because permissive SELECT
-- policies combine with OR and allowed ordinary same-church members to read
-- other members' pledge payments.

drop policy if exists "payments same church" on public.pledge_payments;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pledge_payments'
      and policyname = 'Users can view accessible pledge payments'
      and cmd = 'SELECT'
  ) then
    raise exception 'Required pledge payment access policy is missing';
  end if;
end
$$;
