
-- ============ ENUM ============
CREATE TYPE public.app_role AS ENUM ('aluno', 'treinador');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Policies for profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Trainers view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'));
CREATE POLICY "Trainers manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'))
  WITH CHECK (public.has_role(auth.uid(), 'treinador'));

-- Policies for user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Trainers view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'));

-- Auto-create profile + default aluno role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'aluno');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ EXERCISE GALLERY ============
CREATE TABLE public.exercise_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  muscle_group TEXT NOT NULL DEFAULT '',
  youtube_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_gallery TO authenticated;
GRANT ALL ON public.exercise_gallery TO service_role;
ALTER TABLE public.exercise_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All auth can view gallery" ON public.exercise_gallery FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Trainers manage gallery" ON public.exercise_gallery FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'))
  WITH CHECK (public.has_role(auth.uid(), 'treinador'));

-- ============ TRAINING PLANS ============
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_plans TO authenticated;
GRANT ALL ON public.training_plans TO service_role;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own plans" ON public.training_plans FOR SELECT TO authenticated
  USING (auth.uid() = student_id);
CREATE POLICY "Trainers manage plans" ON public.training_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'))
  WITH CHECK (public.has_role(auth.uid(), 'treinador'));

CREATE TABLE public.training_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  day_label TEXT NOT NULL DEFAULT '',
  exercise_name TEXT NOT NULL DEFAULT '',
  sets TEXT,
  reps TEXT,
  load TEXT,
  rest TEXT,
  notes TEXT,
  gallery_video_id UUID REFERENCES public.exercise_gallery(id) ON DELETE SET NULL,
  order_index INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_exercises TO authenticated;
GRANT ALL ON public.training_exercises TO service_role;
ALTER TABLE public.training_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own exercises" ON public.training_exercises FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_plans p WHERE p.id = plan_id AND p.student_id = auth.uid()));
CREATE POLICY "Trainers manage exercises" ON public.training_exercises FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'))
  WITH CHECK (public.has_role(auth.uid(), 'treinador'));

-- ============ NUTRITION ============
CREATE TABLE public.nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  general_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_plans TO authenticated;
GRANT ALL ON public.nutrition_plans TO service_role;
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own nutrition" ON public.nutrition_plans FOR SELECT TO authenticated
  USING (auth.uid() = student_id);
CREATE POLICY "Trainers manage nutrition" ON public.nutrition_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'))
  WITH CHECK (public.has_role(auth.uid(), 'treinador'));

CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.nutrition_plans(id) ON DELETE CASCADE,
  meal_name TEXT NOT NULL DEFAULT '',
  meal_time TEXT,
  order_index INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals TO authenticated;
GRANT ALL ON public.meals TO service_role;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own meals" ON public.meals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.student_id = auth.uid()));
CREATE POLICY "Trainers manage meals" ON public.meals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'))
  WITH CHECK (public.has_role(auth.uid(), 'treinador'));

CREATE TABLE public.meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL DEFAULT '',
  quantity TEXT,
  notes TEXT,
  calories NUMERIC,
  protein NUMERIC,
  carbs NUMERIC,
  fat NUMERIC,
  order_index INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_items TO authenticated;
GRANT ALL ON public.meal_items TO service_role;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own meal items" ON public.meal_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meals m
    JOIN public.nutrition_plans p ON p.id = m.plan_id
    WHERE m.id = meal_id AND p.student_id = auth.uid()
  ));
CREATE POLICY "Trainers manage meal items" ON public.meal_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'treinador'))
  WITH CHECK (public.has_role(auth.uid(), 'treinador'));
