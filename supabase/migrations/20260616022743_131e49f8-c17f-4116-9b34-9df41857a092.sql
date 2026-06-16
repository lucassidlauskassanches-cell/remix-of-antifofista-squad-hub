
-- Restrict INSERT/UPDATE/DELETE on user_roles to trainers only
CREATE POLICY "Only trainers can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'treinador'));

CREATE POLICY "Only trainers can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'))
  WITH CHECK (public.has_role(auth.uid(), 'treinador'));

CREATE POLICY "Only trainers can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'));
