
CREATE POLICY "quote pdfs select own or admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'quote-pdfs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
CREATE POLICY "quote pdfs insert own or admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quote-pdfs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
CREATE POLICY "quote pdfs update own or admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'quote-pdfs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()))
  WITH CHECK (bucket_id = 'quote-pdfs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
CREATE POLICY "quote pdfs delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'quote-pdfs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
