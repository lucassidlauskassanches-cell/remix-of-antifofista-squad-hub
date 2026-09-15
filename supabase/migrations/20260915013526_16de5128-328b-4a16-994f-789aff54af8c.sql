ALTER TABLE public.student_crm ADD COLUMN IF NOT EXISTS proximo_checkin date;

CREATE POLICY "crm_student_read_own" ON public.student_crm
FOR SELECT TO authenticated
USING (student_id = auth.uid());