
CREATE TABLE public.structured_training_plans (
  student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_name TEXT,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.structured_training_plans TO authenticated;
GRANT ALL ON public.structured_training_plans TO service_role;

ALTER TABLE public.structured_training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student reads own structured plan"
  ON public.structured_training_plans FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "trainer reads own students structured plan"
  ON public.structured_training_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = structured_training_plans.student_id
        AND p.trainer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "trainer inserts structured plan for own student"
  ON public.structured_training_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = structured_training_plans.student_id
        AND p.trainer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "trainer updates structured plan for own student"
  ON public.structured_training_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = structured_training_plans.student_id
        AND p.trainer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = structured_training_plans.student_id
        AND p.trainer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "trainer deletes structured plan for own student"
  ON public.structured_training_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = structured_training_plans.student_id
        AND p.trainer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_structured_training_plans_updated_at
  BEFORE UPDATE ON public.structured_training_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
