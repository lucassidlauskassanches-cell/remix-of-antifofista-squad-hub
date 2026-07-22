
CREATE OR REPLACE FUNCTION public.get_leaderboard(_caller uuid, _period text)
RETURNS TABLE(student_id uuid, full_name text, trainer_id uuid, trainer_name text, points numeric, current_streak integer, rank_position integer, total_participants integer, points_above numeric, is_self boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM app_private.get_leaderboard(_caller, _period);
$$;

CREATE OR REPLACE FUNCTION public.get_trainer_leaderboard(_caller uuid, _period text)
RETURNS TABLE(trainer_id uuid, trainer_name text, active_students bigint, avg_points numeric, avg_streak numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM app_private.get_trainer_leaderboard(_caller, _period);
$$;

REVOKE EXECUTE ON FUNCTION public.get_leaderboard(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trainer_leaderboard(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_trainer_leaderboard(uuid, text) TO service_role;
