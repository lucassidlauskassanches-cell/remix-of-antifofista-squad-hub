INSERT INTO public.user_roles (user_id, role)
VALUES ('4147de62-ed64-4e54-a99f-87b72ae24f0f', 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;