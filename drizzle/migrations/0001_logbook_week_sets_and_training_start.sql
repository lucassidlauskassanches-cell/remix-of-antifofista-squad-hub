ALTER TABLE public.logbook_entries ADD COLUMN week_number integer, ADD COLUMN set_index integer, ADD COLUMN block_label text;
CREATE UNIQUE INDEX logbook_entries_student_exercise_week_set_key ON public.logbook_entries (student_id, exercise, week_number, set_index);
ALTER TABLE public.structured_training_plans ADD COLUMN start_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);
UPDATE public.structured_training_plans SET start_date = (created_at AT TIME ZONE 'America/Sao_Paulo')::date WHERE start_date IS NULL;
COMMENT ON COLUMN public.logbook_entries.week_number IS 'Periodization week; NULL denotes legacy date-based history.';
COMMENT ON COLUMN public.logbook_entries.set_index IS 'One-based prescribed set index; NULL denotes legacy combined sets.';