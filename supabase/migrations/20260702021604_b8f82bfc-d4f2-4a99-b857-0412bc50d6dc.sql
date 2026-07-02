
-- 1. Create private schema and move helpers first
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA app_private;
ALTER FUNCTION public.trainer_owns_student(uuid, uuid) SET SCHEMA app_private;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.trainer_owns_student(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.trainer_owns_student(uuid, uuid) TO authenticated, service_role;

-- Existing policies now automatically render function refs as "app_private.has_role" etc. (OID-tracked).
-- 2. Fix profiles policies
DROP POLICY IF EXISTS "Trainers manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Trainers view all profiles" ON public.profiles;

CREATE POLICY "Trainers view own students profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'treinador'::app_role) AND app_private.trainer_owns_student(auth.uid(), id));

CREATE POLICY "Trainers update own students profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'treinador'::app_role) AND app_private.trainer_owns_student(auth.uid(), id))
  WITH CHECK (app_private.has_role(auth.uid(), 'treinador'::app_role) AND app_private.trainer_owns_student(auth.uid(), id));

CREATE POLICY "Trainers insert student profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'treinador'::app_role) AND trainer_id = auth.uid());

CREATE POLICY "Trainers delete own students profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'treinador'::app_role) AND app_private.trainer_owns_student(auth.uid(), id));

-- 3. exercise_gallery: only admins can modify
DROP POLICY IF EXISTS "Trainers manage gallery" ON public.exercise_gallery;
CREATE POLICY "Admins manage gallery"
  ON public.exercise_gallery FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));

-- 4. user_roles: trainers only see their own students' roles
DROP POLICY IF EXISTS "Trainers view all roles" ON public.user_roles;
CREATE POLICY "Trainers view own students roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'treinador'::app_role) AND app_private.trainer_owns_student(auth.uid(), user_id));
