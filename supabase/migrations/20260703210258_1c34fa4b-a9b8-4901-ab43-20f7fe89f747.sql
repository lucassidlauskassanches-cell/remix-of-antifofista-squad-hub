
CREATE TABLE public.action_plan_inputs (
  student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  anamnese_path TEXT,
  anamnese_name TEXT,
  foto_frente_path TEXT,
  foto_lado_path TEXT,
  foto_costas_path TEXT,
  ciclo_meses INTEGER NOT NULL DEFAULT 12,
  dia_feedback TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plan_inputs TO authenticated;
GRANT ALL ON public.action_plan_inputs TO service_role;

ALTER TABLE public.action_plan_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainer or admin can view action_plan_inputs"
  ON public.action_plan_inputs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = action_plan_inputs.student_id AND p.trainer_id = auth.uid())
  );

CREATE POLICY "Trainer or admin can insert action_plan_inputs"
  ON public.action_plan_inputs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = action_plan_inputs.student_id AND p.trainer_id = auth.uid())
  );

CREATE POLICY "Trainer or admin can update action_plan_inputs"
  ON public.action_plan_inputs FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = action_plan_inputs.student_id AND p.trainer_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = action_plan_inputs.student_id AND p.trainer_id = auth.uid())
  );

CREATE POLICY "Trainer or admin can delete action_plan_inputs"
  ON public.action_plan_inputs FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = action_plan_inputs.student_id AND p.trainer_id = auth.uid())
  );

CREATE TRIGGER update_action_plan_inputs_updated_at
  BEFORE UPDATE ON public.action_plan_inputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
