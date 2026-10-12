
CREATE POLICY "branding read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'branding');
CREATE POLICY "branding admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.is_admin());
CREATE POLICY "branding admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND public.is_admin()) WITH CHECK (bucket_id = 'branding' AND public.is_admin());
CREATE POLICY "branding admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.is_admin());
