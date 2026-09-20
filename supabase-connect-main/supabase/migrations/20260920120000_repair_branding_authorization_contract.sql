-- Repair church-assets manager Storage RLS path matching.
--
-- The historical policy body used an unqualified Storage object path column
-- inside subqueries over public.churches. In Production, PostgreSQL resolved
-- that reference to the church name column instead of the storage.objects row
-- path, so the tenant folder comparison always missed real object paths such as:
--
--   <church-id>/banners/banner.webp
--
-- This migration changes only the authenticated write policies for
-- church-assets manager uploads. Public read behavior is intentionally left
-- untouched.

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "Church managers can upload church assets" on storage.objects;
    create policy "Church managers can upload church assets"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'church-assets'
      and exists (
        select 1
        from public.churches c
        where c.id::text = (storage.foldername(storage.objects.name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    );

    drop policy if exists "Church managers can update church assets" on storage.objects;
    create policy "Church managers can update church assets"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'church-assets'
      and exists (
        select 1
        from public.churches c
        where c.id::text = (storage.foldername(storage.objects.name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    )
    with check (
      bucket_id = 'church-assets'
      and exists (
        select 1
        from public.churches c
        where c.id::text = (storage.foldername(storage.objects.name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    );

    drop policy if exists "Church managers can delete church assets" on storage.objects;
    create policy "Church managers can delete church assets"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'church-assets'
      and exists (
        select 1
        from public.churches c
        where c.id::text = (storage.foldername(storage.objects.name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    );
  end if;
end $$;
