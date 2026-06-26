-- RC-1.1.3 Security Remediation: restrict church asset writes to authorized church managers.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    drop policy if exists "Authenticated can delete church assets" on storage.objects;
    drop policy if exists "Authenticated can update church assets" on storage.objects;
    drop policy if exists "Authenticated can upload church assets" on storage.objects;

    drop policy if exists "Church managers can delete church assets" on storage.objects;
    drop policy if exists "Church managers can update church assets" on storage.objects;
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
        where c.id::text = (storage.foldername(name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    );

    create policy "Church managers can update church assets"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'church-assets'
      and exists (
        select 1
        from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    )
    with check (
      bucket_id = 'church-assets'
      and exists (
        select 1
        from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    );

    create policy "Church managers can delete church assets"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'church-assets'
      and exists (
        select 1
        from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.can_manage_church_workspace(auth.uid(), c.id)
      )
    );
  end if;
end $$;
