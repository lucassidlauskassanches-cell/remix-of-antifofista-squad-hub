
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- action_plans
CREATE TABLE public.action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  title TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  pdf_path TEXT,
  pdf_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_plans select"
  ON public.action_plans FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_role(auth.uid(), 'treinador')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "action_plans trainer manage"
  ON public.action_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'treinador') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'treinador') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_action_plans_updated_at
  BEFORE UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- logbook_entries
CREATE TABLE public.logbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  exercise TEXT NOT NULL DEFAULT '',
  load TEXT NOT NULL DEFAULT '',
  reps TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logbook_entries TO authenticated;
GRANT ALL ON public.logbook_entries TO service_role;
ALTER TABLE public.logbook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logbook student manage own"
  ON public.logbook_entries FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "logbook trainer view"
  ON public.logbook_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'treinador') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_logbook_entries_updated_at
  BEFORE UPDATE ON public.logbook_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
