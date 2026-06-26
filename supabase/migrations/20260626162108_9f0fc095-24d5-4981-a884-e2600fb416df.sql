
DROP POLICY IF EXISTS "Only trainers can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only trainers can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only trainers can delete roles" ON public.user_roles;

CREATE POLICY "Trainers can insert aluno roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'treinador'::app_role) AND role = 'aluno'::app_role);

CREATE POLICY "Trainers can update aluno roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'treinador'::app_role) AND role = 'aluno'::app_role)
WITH CHECK (has_role(auth.uid(), 'treinador'::app_role) AND role = 'aluno'::app_role);

CREATE POLICY "Trainers can delete aluno roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'treinador'::app_role) AND role = 'aluno'::app_role);
