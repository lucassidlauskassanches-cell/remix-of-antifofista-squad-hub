
CREATE TABLE public.diet_prescriptions (
  student_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source_name TEXT,
  observacoes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diet_prescriptions TO authenticated;
GRANT ALL ON public.diet_prescriptions TO service_role;

ALTER TABLE public.diet_prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student reads own diet"
  ON public.diet_prescriptions FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Trainer reads own students diet"
  ON public.diet_prescriptions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = student_id AND p.trainer_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Trainer writes student diet"
  ON public.diet_prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = student_id AND p.trainer_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Trainer updates student diet"
  ON public.diet_prescriptions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = student_id AND p.trainer_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = student_id AND p.trainer_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Trainer deletes student diet"
  ON public.diet_prescriptions FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = student_id AND p.trainer_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_diet_prescriptions_updated_at
  BEFORE UPDATE ON public.diet_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
