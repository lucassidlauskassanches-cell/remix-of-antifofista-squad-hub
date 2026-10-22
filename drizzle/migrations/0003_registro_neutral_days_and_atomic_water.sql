CREATE TABLE public.registro_neutral_days (student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, log_date date NOT NULL, enabled boolean NOT NULL DEFAULT true, created_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(student_id, log_date));
GRANT SELECT, INSERT, UPDATE ON public.registro_neutral_days TO authenticated;
GRANT ALL ON public.registro_neutral_days TO service_role;
ALTER TABLE public.registro_neutral_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY neutral_days_owner ON public.registro_neutral_days FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY neutral_days_trainer ON public.registro_neutral_days FOR ALL TO authenticated USING (app_private.trainer_owns_student(auth.uid(), student_id)) WITH CHECK (app_private.trainer_owns_student(auth.uid(), student_id) AND created_by = auth.uid());
CREATE POLICY neutral_days_admin ON public.registro_neutral_days FOR ALL TO authenticated USING (app_private.has_role(auth.uid(), 'admin')) WITH CHECK (app_private.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE FUNCTION public.add_registro_water(p_log_id uuid, p_delta integer) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$ BEGIN
IF p_delta < -5000 OR p_delta > 5000 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
UPDATE public.daily_logs SET water_ml = greatest(0, least(20000, water_ml + p_delta)) WHERE id = p_log_id AND student_id = auth.uid();
IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.add_registro_water(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_registro_water(uuid, integer) TO authenticated, service_role;