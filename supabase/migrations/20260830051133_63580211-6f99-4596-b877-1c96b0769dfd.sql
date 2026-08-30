-- ===== Enums =====
CREATE TYPE public.crm_status AS ENUM ('ativo','aguardando_checkin','aguardando_resposta','plano_a_montar','renovacao_proxima');
CREATE TYPE public.crm_plano_tipo AS ENUM ('mensal','trimestral','semestral');
CREATE TYPE public.note_categoria AS ENUM ('dieta','treino','saude','sono','feedback','ajuste','geral');
CREATE TYPE public.checkin_status AS ENUM ('recebido','respondido');

-- ===== student_crm =====
CREATE TABLE public.student_crm (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  objetivo text,
  restricoes text,
  plano_tipo public.crm_plano_tipo,
  data_inicio date,
  data_vencimento date,
  status public.crm_status NOT NULL DEFAULT 'ativo',
  whatsapp_grupo_url text,
  checkin_dia smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_crm TO authenticated;
GRANT ALL ON public.student_crm TO service_role;
ALTER TABLE public.student_crm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_trainer_all" ON public.student_crm FOR ALL TO authenticated
  USING (app_private.trainer_owns_student(auth.uid(), student_id))
  WITH CHECK (app_private.trainer_owns_student(auth.uid(), student_id));
CREATE POLICY "crm_admin_all" ON public.student_crm FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER student_crm_updated_at BEFORE UPDATE ON public.student_crm
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== student_notes =====
CREATE TABLE public.student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  categoria public.note_categoria NOT NULL DEFAULT 'geral',
  texto text NOT NULL,
  anexo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_notes_student_idx ON public.student_notes (student_id, data DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_notes TO authenticated;
GRANT ALL ON public.student_notes TO service_role;
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_trainer_all" ON public.student_notes FOR ALL TO authenticated
  USING (app_private.trainer_owns_student(auth.uid(), student_id))
  WITH CHECK (app_private.trainer_owns_student(auth.uid(), student_id));
CREATE POLICY "notes_admin_all" ON public.student_notes FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER student_notes_updated_at BEFORE UPDATE ON public.student_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== checkins =====
CREATE TABLE public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_recebida date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  data_respondida date,
  peso_medio numeric,
  fotos_ok boolean NOT NULL DEFAULT false,
  medidas text,
  adesao text,
  fome_sono_energia text,
  o_que_mudou text,
  explicacao text,
  status public.checkin_status NOT NULL DEFAULT 'recebido',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX checkins_student_idx ON public.checkins (student_id, data_recebida DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkins_trainer_all" ON public.checkins FOR ALL TO authenticated
  USING (app_private.trainer_owns_student(auth.uid(), student_id))
  WITH CHECK (app_private.trainer_owns_student(auth.uid(), student_id));
CREATE POLICY "checkins_admin_all" ON public.checkins FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER checkins_updated_at BEFORE UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== reminders =====
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_alvo date NOT NULL,
  texto text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reminders_student_idx ON public.reminders (student_id, data_alvo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_trainer_all" ON public.reminders FOR ALL TO authenticated
  USING (app_private.trainer_owns_student(auth.uid(), student_id))
  WITH CHECK (app_private.trainer_owns_student(auth.uid(), student_id));
CREATE POLICY "reminders_admin_all" ON public.reminders FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER reminders_updated_at BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();