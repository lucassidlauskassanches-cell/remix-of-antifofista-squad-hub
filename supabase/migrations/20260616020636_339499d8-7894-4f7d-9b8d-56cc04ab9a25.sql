
ALTER TABLE public.training_plans ADD COLUMN IF NOT EXISTS pdf_path text, ADD COLUMN IF NOT EXISTS pdf_name text;
ALTER TABLE public.nutrition_plans ADD COLUMN IF NOT EXISTS pdf_path text, ADD COLUMN IF NOT EXISTS pdf_name text;

-- Storage policies for 'plans' bucket
CREATE POLICY "Trainers manage plan files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'plans' AND public.has_role(auth.uid(), 'treinador'::public.app_role))
WITH CHECK (bucket_id = 'plans' AND public.has_role(auth.uid(), 'treinador'::public.app_role));

CREATE POLICY "Students read own plan files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'plans'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
