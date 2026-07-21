GRANT USAGE ON SCHEMA app_private TO service_role;
GRANT EXECUTE ON FUNCTION app_private.get_trainer_leaderboard(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION app_private.get_leaderboard(uuid, text) TO service_role;