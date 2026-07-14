import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profileResult, rolesResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileResult.error) throw new Error(profileResult.error.message);
    if (rolesResult.error) throw new Error(rolesResult.error.message);

    const roles = (rolesResult.data ?? []).map((row) => row.role);
    return {
      userId,
      profile: profileResult.data,
      isTreinador: roles.includes("treinador"),
      isAluno: roles.includes("aluno"),
      isAdmin: roles.includes("admin"),
    };
  });

export const listTrainersForStudentForm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: callerRoles, error: callerError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (callerError) throw new Error(callerError.message);
    if (!(callerRoles ?? []).some((row) => row.role === "admin")) {
      throw new Error("Apenas administradores podem listar treinadores.");
    }

    const { data: trainerRoles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "treinador");
    if (rolesError) throw new Error(rolesError.message);

    const ids = (trainerRoles ?? []).map((row) => row.user_id);
    if (!ids.length) return { rows: [] };

    const { data: profiles, error: profilesError } = await context.supabase
      .from("profiles")
      .select("id,full_name,email,phone,created_at")
      .in("id", ids)
      .order("full_name");
    if (profilesError) throw new Error(profilesError.message);
    return { rows: profiles ?? [] };
  });

export const createStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(200),
        phone: z.string().trim().max(40).optional(),
        trainer_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: callerRoles, error: callerError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["treinador", "admin"]);
    if (callerError) throw new Error(callerError.message);

    const roles = (callerRoles ?? []).map((row) => row.role);
    if (!roles.length) throw new Error("Você não tem permissão para cadastrar alunos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createError || !created.user) {
      throw new Error(
        createError?.message?.toLowerCase().includes("already")
          ? "Já existe uma conta com este e-mail."
          : createError?.message ?? "Não foi possível criar o aluno.",
      );
    }

    const newId = created.user.id;
    const trainerId = roles.includes("admin") ? (data.trainer_id ?? null) : context.userId;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: newId,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone ?? null,
        trainer_id: trainerId,
      },
      { onConflict: "id" },
    );
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: newId, role: "aluno" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

    if (profileError || roleError) {
      await supabaseAdmin.auth.admin.deleteUser(newId);
      throw new Error(profileError?.message ?? roleError?.message ?? "Falha ao preparar o acesso do aluno.");
    }

    return { id: newId };
  });