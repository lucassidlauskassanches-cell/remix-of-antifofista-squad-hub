GRANT SELECT, INSERT, UPDATE, DELETE ON public.logbook_entries TO authenticated;
GRANT ALL ON public.logbook_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;