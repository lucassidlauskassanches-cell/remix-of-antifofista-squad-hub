
-- 1. Logbook: trainers only see entries of their own students
DROP POLICY IF EXISTS "logbook trainer view" ON public.logbook_entries;
CREATE POLICY "logbook trainer view" ON public.logbook_entries
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'treinador'::app_role)
    AND public.trainer_owns_student(auth.uid(), student_id)
  )
);

-- 2. user_roles: trainers can only assign/update/delete 'aluno' role for their own students
DROP POLICY IF EXISTS "Trainers can insert aluno roles" ON public.user_roles;
DROP POLICY IF EXISTS "Trainers can update aluno roles" ON public.user_roles;
DROP POLICY IF EXISTS "Trainers can delete aluno roles" ON public.user_roles;

CREATE POLICY "Trainers can insert aluno roles" ON public.user_roles
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'treinador'::app_role)
  AND role = 'aluno'::app_role
  AND public.trainer_owns_student(auth.uid(), user_id)
);

CREATE POLICY "Trainers can update aluno roles" ON public.user_roles
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'treinador'::app_role)
  AND role = 'aluno'::app_role
  AND public.trainer_owns_student(auth.uid(), user_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'treinador'::app_role)
  AND role = 'aluno'::app_role
  AND public.trainer_owns_student(auth.uid(), user_id)
);

CREATE POLICY "Trainers can delete aluno roles" ON public.user_roles
FOR DELETE
USING (
  public.has_role(auth.uid(), 'treinador'::app_role)
  AND role = 'aluno'::app_role
  AND public.trainer_owns_student(auth.uid(), user_id)
);

-- 3. Lock down SECURITY DEFINER functions
-- handle_new_user is a trigger function; no one should call it directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role and trainer_owns_student are only used inside RLS policies / server code;
-- revoke from anon (no anonymous callers) and PUBLIC; keep for authenticated and service_role
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trainer_owns_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trainer_owns_student(uuid, uuid) TO authenticated, service_role;
