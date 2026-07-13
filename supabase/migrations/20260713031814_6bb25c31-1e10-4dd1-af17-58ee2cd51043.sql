DROP POLICY IF EXISTS "Admins manage gallery" ON public.exercise_gallery;
CREATE POLICY "Trainers and admins manage gallery"
  ON public.exercise_gallery FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'treinador') OR app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'treinador') OR app_private.has_role(auth.uid(), 'admin'));