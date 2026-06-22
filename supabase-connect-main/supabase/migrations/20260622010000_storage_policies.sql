-- Application storage policies are applied after the baseline so Supabase-managed
-- storage.objects already exists.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name = 'objects'
  ) THEN

-- Name: objects Admins read record preservation proofs; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins read record preservation proofs" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'record-preservation-proofs'::text) AND ((EXISTS ( SELECT 1
   FROM public.super_admins sa
  WHERE (sa.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND ((ur.church_id)::text = (storage.foldername(objects.name))[1]) AND (ur.role = ANY (ARRAY['church_admin'::text, 'pastor'::text, 'secretary'::text, 'treasurer'::text, 'admin'::text]))))))));


--
-- Name: objects Authenticated can delete church assets; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated can delete church assets" ON storage.objects FOR DELETE TO authenticated USING ((bucket_id = 'church-assets'::text));


--
-- Name: objects Authenticated can update church assets; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated can update church assets" ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'church-assets'::text)) WITH CHECK ((bucket_id = 'church-assets'::text));


--
-- Name: objects Authenticated can upload church assets; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated can upload church assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'church-assets'::text));


--
-- Name: objects Members read own record preservation proofs; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Members read own record preservation proofs" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'record-preservation-proofs'::text) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE (((m.church_id)::text = (storage.foldername(objects.name))[1]) AND ((m.id)::text = (storage.foldername(objects.name))[2]) AND (m.user_id = auth.uid()))))));


--
-- Name: objects Members upload record preservation proofs; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Members upload record preservation proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'record-preservation-proofs'::text) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE (((m.church_id)::text = (storage.foldername(objects.name))[1]) AND ((m.id)::text = (storage.foldername(objects.name))[2]) AND (m.user_id = auth.uid()))))));


--
-- Name: objects Public can read church assets; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public can read church assets" ON storage.objects FOR SELECT USING ((bucket_id = 'church-assets'::text));


--
-- Name: objects Super admins can read billing receipts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Super admins can read billing receipts" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'billing-receipts'::text) AND public.is_platform_super_admin(auth.uid())));


--
-- Name: objects Workspace managers can read billing receipts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Workspace managers can read billing receipts" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'billing-receipts'::text) AND (EXISTS ( SELECT 1
   FROM public.churches c
  WHERE (((c.id)::text = (storage.foldername(c.name))[1]) AND public.can_manage_church_workspace(auth.uid(), c.id))))));


--
-- Name: objects Workspace managers can upload billing receipts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Workspace managers can upload billing receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'billing-receipts'::text) AND (EXISTS ( SELECT 1
   FROM public.churches c
  WHERE (((c.id)::text = (storage.foldername(c.name))[1]) AND public.can_manage_church_workspace(auth.uid(), c.id))))));


--

  END IF;
END $$;

