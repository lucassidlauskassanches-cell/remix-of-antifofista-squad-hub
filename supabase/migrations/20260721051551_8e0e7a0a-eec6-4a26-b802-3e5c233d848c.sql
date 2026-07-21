
CREATE OR REPLACE FUNCTION public.get_leaderboard(period text)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  trainer_id uuid,
  trainer_name text,
  points numeric,
  current_streak integer,
  rank_position integer,
  total_participants integer,
  points_above numeric,
  is_self boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  is_admin boolean;
  is_trainer boolean;
  start_date date;
  today_sp date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF period = 'weekly' THEN
    start_date := today_sp - ((EXTRACT(ISODOW FROM today_sp)::int) - 1);
  ELSIF period = 'monthly' THEN
    start_date := date_trunc('month', today_sp)::date;
  ELSE
    RAISE EXCEPTION 'invalid period';
  END IF;

  is_admin := app_private.has_role(caller, 'admin'::app_role);
  is_trainer := app_private.has_role(caller, 'treinador'::app_role);

  RETURN QUERY
  WITH student_pts AS (
    SELECT
      p.id AS s_id,
      p.full_name AS s_name,
      p.trainer_id AS t_id,
      tp.full_name AS t_name,
      COALESCE(SUM(dl.daily_score) FILTER (WHERE dl.log_date >= start_date), 0)::numeric AS pts,
      COALESCE(MAX(s.current_streak), 0)::int AS streak
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'aluno'::app_role
    LEFT JOIN public.profiles tp ON tp.id = p.trainer_id
    LEFT JOIN public.daily_logs dl ON dl.student_id = p.id
    LEFT JOIN public.streaks s ON s.student_id = p.id
    WHERE p.active
    GROUP BY p.id, p.full_name, p.trainer_id, tp.full_name
  ),
  ranked AS (
    SELECT
      sp.*,
      RANK() OVER (ORDER BY sp.pts DESC, sp.streak DESC, sp.s_name ASC) AS pos,
      COUNT(*) FILTER (WHERE sp.pts > 0) OVER () AS total,
      LAG(sp.pts) OVER (ORDER BY sp.pts DESC, sp.streak DESC, sp.s_name ASC) AS pts_above
    FROM student_pts sp
  )
  SELECT
    r.s_id, r.s_name, r.t_id, r.t_name,
    r.pts, r.streak, r.pos::int, r.total::int, r.pts_above,
    (r.s_id = caller)
  FROM ranked r
  WHERE
    is_admin
    OR (is_trainer AND r.t_id = caller)
    OR ((NOT is_admin) AND (NOT is_trainer) AND r.s_id = caller)
  ORDER BY r.pos ASC, r.s_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_trainer_leaderboard(period text DEFAULT 'monthly')
RETURNS TABLE (
  trainer_id uuid,
  trainer_name text,
  active_students integer,
  avg_points numeric,
  avg_streak numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  is_admin boolean;
  start_date date;
  today_sp date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  is_admin := app_private.has_role(caller, 'admin'::app_role);
  IF NOT is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF period = 'weekly' THEN
    start_date := today_sp - ((EXTRACT(ISODOW FROM today_sp)::int) - 1);
  ELSE
    start_date := date_trunc('month', today_sp)::date;
  END IF;

  RETURN QUERY
  WITH per_student AS (
    SELECT
      p.id AS s_id,
      p.trainer_id AS t_id,
      COALESCE(SUM(dl.daily_score) FILTER (WHERE dl.log_date >= start_date), 0)::numeric AS pts,
      COALESCE(MAX(s.current_streak), 0)::int AS streak
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'aluno'::app_role
    LEFT JOIN public.daily_logs dl ON dl.student_id = p.id
    LEFT JOIN public.streaks s ON s.student_id = p.id
    WHERE p.active AND p.trainer_id IS NOT NULL
    GROUP BY p.id, p.trainer_id
  )
  SELECT
    t.id, t.full_name,
    COUNT(ps.s_id)::int,
    COALESCE(AVG(ps.pts), 0)::numeric,
    COALESCE(AVG(ps.streak), 0)::numeric
  FROM public.profiles t
  JOIN public.user_roles ur ON ur.user_id = t.id AND ur.role = 'treinador'::app_role
  LEFT JOIN per_student ps ON ps.t_id = t.id
  GROUP BY t.id, t.full_name
  ORDER BY 4 DESC, t.full_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trainer_leaderboard(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trainer_leaderboard(text) TO authenticated;
