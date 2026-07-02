-- Rest day flag on daily logs
ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS rest_day boolean NOT NULL DEFAULT false;

-- Streaks table (one row per student)
CREATE TABLE IF NOT EXISTS public.streaks (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_completed_date date,
  shields int NOT NULL DEFAULT 0,
  shield_progress int NOT NULL DEFAULT 0,
  total_completed_days int NOT NULL DEFAULT 0,
  last_milestone int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.streaks TO authenticated;
GRANT ALL ON public.streaks TO service_role;

ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streaks_student_manage_own"
  ON public.streaks
  FOR ALL
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "streaks_trainer_read_own_students"
  ON public.streaks
  FOR SELECT
  TO authenticated
  USING (app_private.trainer_owns_student(auth.uid(), student_id));

CREATE POLICY "streaks_admin_all"
  ON public.streaks
  FOR ALL
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER streaks_updated_at
  BEFORE UPDATE ON public.streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();