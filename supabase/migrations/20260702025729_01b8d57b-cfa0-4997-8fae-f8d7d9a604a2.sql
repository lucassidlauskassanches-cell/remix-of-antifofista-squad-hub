
-- 1) Anamnese fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,2),
  ADD COLUMN IF NOT EXISTS initial_weight_kg numeric(6,2),
  ADD COLUMN IF NOT EXISTS water_ml_per_kg integer NOT NULL DEFAULT 50
    CHECK (water_ml_per_kg BETWEEN 20 AND 80);

-- 2) weight_entries
CREATE TABLE IF NOT EXISTS public.weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  weight_kg numeric(6,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, entry_date)
);
CREATE INDEX IF NOT EXISTS weight_entries_student_date_idx
  ON public.weight_entries (student_id, entry_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_entries TO authenticated;
GRANT ALL ON public.weight_entries TO service_role;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student manages own weights"
  ON public.weight_entries FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "trainer reads own students weights"
  ON public.weight_entries FOR SELECT TO authenticated
  USING (app_private.trainer_owns_student(auth.uid(), student_id));

CREATE POLICY "admin reads all weights"
  ON public.weight_entries FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) daily_logs
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  water_ml integer NOT NULL DEFAULT 0 CHECK (water_ml >= 0 AND water_ml <= 20000),
  trained boolean NOT NULL DEFAULT false,
  daily_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (daily_score >= 0 AND daily_score <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, log_date)
);
CREATE INDEX IF NOT EXISTS daily_logs_student_date_idx
  ON public.daily_logs (student_id, log_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_logs TO authenticated;
GRANT ALL ON public.daily_logs TO service_role;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student manages own daily logs"
  ON public.daily_logs FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "trainer reads own students daily logs"
  ON public.daily_logs FOR SELECT TO authenticated
  USING (app_private.trainer_owns_student(auth.uid(), student_id));

CREATE POLICY "admin reads all daily logs"
  ON public.daily_logs FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER daily_logs_touch_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) meal_checks
CREATE TABLE IF NOT EXISTS public.meal_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  meal_name text NOT NULL CHECK (char_length(meal_name) BETWEEN 1 AND 120),
  done boolean NOT NULL DEFAULT false,
  rating smallint NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  order_index integer NOT NULL DEFAULT 0,
  UNIQUE (daily_log_id, meal_name)
);
CREATE INDEX IF NOT EXISTS meal_checks_log_idx ON public.meal_checks(daily_log_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_checks TO authenticated;
GRANT ALL ON public.meal_checks TO service_role;
ALTER TABLE public.meal_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student manages own meal checks"
  ON public.meal_checks FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.daily_logs dl
    WHERE dl.id = daily_log_id AND dl.student_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.daily_logs dl
    WHERE dl.id = daily_log_id AND dl.student_id = auth.uid()
  ));

CREATE POLICY "trainer reads own students meal checks"
  ON public.meal_checks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.daily_logs dl
    WHERE dl.id = daily_log_id
      AND app_private.trainer_owns_student(auth.uid(), dl.student_id)
  ));

CREATE POLICY "admin reads all meal checks"
  ON public.meal_checks FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5) allow trainer to update water_ml_per_kg on own students (profiles already has trainer policies; ensure UPDATE covers this column via existing policy). No extra policy needed if trainer_owns_student UPDATE already exists on profiles.
