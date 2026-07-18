
-- Extensions for scheduling and HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. push_subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subscriptions"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own subscriptions"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2. notification_log
CREATE TABLE public.notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('morning_water','water_gap','reengagement')),
  sent_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, sent_date)
);
CREATE INDEX idx_notification_log_user_date ON public.notification_log(user_id, sent_date);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notification log"
  ON public.notification_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Schedule cron jobs (Brasília = UTC-3 all year)
-- Unschedule any existing ones with same names (safe if not present)
DO $$ BEGIN
  PERFORM cron.unschedule('notify-morning-water');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('notify-reengagement');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('notify-water-gap');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'notify-morning-water', '0 11 * * *',
  $cron$ SELECT net.http_post(
    url := 'https://project--orxuhpewlxaohnpxsiuz.lovable.app/api/public/cron/morning-water',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeHVocGV3bHhhb2hucHhzaXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MDg5NjYsImV4cCI6MjA5ODE4NDk2Nn0.wMuyu3ZVQ9jpta3zzqqinLHnBrPjhtqOhbNrvxOYFsE"}'::jsonb,
    body := '{}'::jsonb
  ); $cron$
);

SELECT cron.schedule(
  'notify-reengagement', '0 21 * * *',
  $cron$ SELECT net.http_post(
    url := 'https://project--orxuhpewlxaohnpxsiuz.lovable.app/api/public/cron/reengagement',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeHVocGV3bHhhb2hucHhzaXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MDg5NjYsImV4cCI6MjA5ODE4NDk2Nn0.wMuyu3ZVQ9jpta3zzqqinLHnBrPjhtqOhbNrvxOYFsE"}'::jsonb,
    body := '{}'::jsonb
  ); $cron$
);

SELECT cron.schedule(
  'notify-water-gap', '0 23 * * *',
  $cron$ SELECT net.http_post(
    url := 'https://project--orxuhpewlxaohnpxsiuz.lovable.app/api/public/cron/water-gap',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeHVocGV3bHhhb2hucHhzaXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MDg5NjYsImV4cCI6MjA5ODE4NDk2Nn0.wMuyu3ZVQ9jpta3zzqqinLHnBrPjhtqOhbNrvxOYFsE"}'::jsonb,
    body := '{}'::jsonb
  ); $cron$
);
