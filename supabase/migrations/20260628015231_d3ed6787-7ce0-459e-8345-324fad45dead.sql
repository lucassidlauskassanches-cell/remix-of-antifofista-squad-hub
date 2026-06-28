
-- Helper: trainer owns student
CREATE OR REPLACE FUNCTION public.trainer_owns_student(_trainer_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _student_id AND trainer_id = _trainer_id
  )
$$;

-- training_plans
DROP POLICY IF EXISTS "Trainers manage plans" ON public.training_plans;
CREATE POLICY "Trainers manage assigned plans" ON public.training_plans
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'treinador') AND public.trainer_owns_student(auth.uid(), student_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'treinador') AND public.trainer_owns_student(auth.uid(), student_id))
);

-- training_exercises (scoped via plan->student)
DROP POLICY IF EXISTS "Trainers manage exercises" ON public.training_exercises;
CREATE POLICY "Trainers manage assigned exercises" ON public.training_exercises
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'treinador')
    AND EXISTS (
      SELECT 1 FROM public.training_plans p
      WHERE p.id = training_exercises.plan_id
        AND public.trainer_owns_student(auth.uid(), p.student_id)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'treinador')
    AND EXISTS (
      SELECT 1 FROM public.training_plans p
      WHERE p.id = training_exercises.plan_id
        AND public.trainer_owns_student(auth.uid(), p.student_id)
    )
  )
);

-- nutrition_plans
DROP POLICY IF EXISTS "Trainers manage nutrition" ON public.nutrition_plans;
CREATE POLICY "Trainers manage assigned nutrition" ON public.nutrition_plans
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'treinador') AND public.trainer_owns_student(auth.uid(), student_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'treinador') AND public.trainer_owns_student(auth.uid(), student_id))
);

-- meals
DROP POLICY IF EXISTS "Trainers manage meals" ON public.meals;
CREATE POLICY "Trainers manage assigned meals" ON public.meals
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'treinador')
    AND EXISTS (
      SELECT 1 FROM public.nutrition_plans p
      WHERE p.id = meals.plan_id
        AND public.trainer_owns_student(auth.uid(), p.student_id)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'treinador')
    AND EXISTS (
      SELECT 1 FROM public.nutrition_plans p
      WHERE p.id = meals.plan_id
        AND public.trainer_owns_student(auth.uid(), p.student_id)
    )
  )
);

-- meal_items
DROP POLICY IF EXISTS "Trainers manage meal items" ON public.meal_items;
CREATE POLICY "Trainers manage assigned meal items" ON public.meal_items
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'treinador')
    AND EXISTS (
      SELECT 1 FROM public.meals m
      JOIN public.nutrition_plans p ON p.id = m.plan_id
      WHERE m.id = meal_items.meal_id
        AND public.trainer_owns_student(auth.uid(), p.student_id)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'treinador')
    AND EXISTS (
      SELECT 1 FROM public.meals m
      JOIN public.nutrition_plans p ON p.id = m.plan_id
      WHERE m.id = meal_items.meal_id
        AND public.trainer_owns_student(auth.uid(), p.student_id)
    )
  )
);

-- action_plans
DROP POLICY IF EXISTS "action_plans select" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans trainer manage" ON public.action_plans;
CREATE POLICY "action_plans select scoped" ON public.action_plans
FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'treinador') AND public.trainer_owns_student(auth.uid(), student_id))
);
CREATE POLICY "action_plans manage scoped" ON public.action_plans
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'treinador') AND public.trainer_owns_student(auth.uid(), student_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'treinador') AND public.trainer_owns_student(auth.uid(), student_id))
);

-- Storage: plans bucket
DROP POLICY IF EXISTS "Trainers manage plan files" ON storage.objects;
CREATE POLICY "Trainers manage assigned plan files" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'plans'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'treinador')
      AND public.trainer_owns_student(
        auth.uid(),
        NULLIF((storage.foldername(name))[1], '')::uuid
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'plans'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'treinador')
      AND public.trainer_owns_student(
        auth.uid(),
        NULLIF((storage.foldername(name))[1], '')::uuid
      )
    )
  )
);
