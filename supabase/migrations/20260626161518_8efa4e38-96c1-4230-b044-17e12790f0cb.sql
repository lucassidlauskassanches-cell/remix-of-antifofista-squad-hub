
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_trainer_id ON public.profiles(trainer_id);

-- Backfill existing students to the only current trainer (Michel)
UPDATE public.profiles p
SET trainer_id = '40fa5e52-9074-47f2-8b39-9c886c0766a5'
WHERE trainer_id IS NULL
  AND id <> '40fa5e52-9074-47f2-8b39-9c886c0766a5'
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'aluno');
