-- The role-permission editor is an interactive, actor-authorized RPC. A
-- service-role client has no legitimate workflow dependency on this function
-- and must not bypass its authenticated-user boundary through an inherited
-- default function privilege.
--
-- Keep the function body and authenticated grant unchanged. Reassert the
-- complete intended ACL with the exact function signature so overloaded or
-- future functions are unaffected.
revoke all on function public.save_church_role_permissions(uuid, text, jsonb) from public;
revoke all on function public.save_church_role_permissions(uuid, text, jsonb) from anon;
revoke all on function public.save_church_role_permissions(uuid, text, jsonb) from service_role;
grant execute on function public.save_church_role_permissions(uuid, text, jsonb) to authenticated;

-- Applied by the deliberately single-file staging workflow. Keeping the
-- ledger write in the same transaction prevents a failed ACL change from
-- being recorded as applied.
insert into supabase_migrations.schema_migrations (version, name, statements)
values (
  '20260727140000',
  'revoke_service_role_permission_editor_rpc',
  null
)
on conflict (version) do nothing;
