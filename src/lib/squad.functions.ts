import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// type-only: apagado no build, não vai pro bundle do cliente.
import type { GenerateInputs } from "@/lib/plano/anthropic";

// ===== Role / profile =====

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleList = (roles ?? []).map((r) => r.role);
    return {
      userId,
      profile,
      isTreinador: roleList.includes("treinador"),
      isAluno: roleList.includes("aluno"),
      isAdmin: roleList.includes("admin"),
    };
  });

// ===== Admin guard =====
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin required");
}

// ===== Admin: trainers CRUD =====
export const listTrainers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: trainerRoles } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "treinador");
    const ids = (trainerRoles ?? []).map((r: any) => r.user_id);
    if (!ids.length) return { rows: [] as any[] };
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id,full_name,email,phone,created_at")
      .in("id", ids)
      .order("full_name");
    return { rows: profiles ?? [] };
  });

const createTrainerInput = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(200),
  phone: z.string().trim().max(40).optional(),
});

export const createTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createTrainerInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    // Try create; if user already exists, reuse it
    let userId: string | null = null;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (created?.user) userId = created.user.id;
    else if (error) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const found = list?.users?.find(
        (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
      );
      if (!found) throw new Error(error.message);
      userId = found.id;
    }
    if (!userId) throw new Error("Falha ao criar treinador");
    // Idempotent: ensure profile row exists even if trigger didn't fire
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: data.email,
          full_name: data.full_name,
          phone: data.phone ?? null,
        },
        { onConflict: "id" },
      );
    // Grant treinador role; remove aluno default to keep panel clean
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "treinador" as any },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "aluno" as any);
    return { id: userId };
  });

export const removeTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId)
      throw new Error("Não é possível remover a si mesmo.");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "treinador" as any);
    return { ok: true };
  });


// ===== Aluno: views =====

export const getMyTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase
      .from("training_plans")
      .select("*")
      .eq("student_id", userId)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) return { plan: null, exercises: [] as any[] };
    const { data: exercises } = await supabase
      .from("training_exercises")
      .select("*, gallery:exercise_gallery(id,title,youtube_url,muscle_group)")
      .eq("plan_id", plan.id)
      .order("order_index");
    return { plan, exercises: exercises ?? [] };
  });

export const getMyNutrition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase
      .from("nutrition_plans")
      .select("*")
      .eq("student_id", userId)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) return { plan: null, meals: [] as any[], items: [] as any[] };
    const { data: meals } = await supabase
      .from("meals")
      .select("*")
      .eq("plan_id", plan.id)
      .order("order_index");
    const mealIds = (meals ?? []).map((m) => m.id);
    const { data: items } = mealIds.length
      ? await supabase
          .from("meal_items")
          .select("*")
          .in("meal_id", mealIds)
          .order("order_index")
      : { data: [] };
    return { plan, meals: meals ?? [], items: items ?? [] };
  });

export const listGallery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("exercise_gallery")
      .select("*")
      .order("muscle_group")
      .order("title");
    return { items: data ?? [] };
  });

// ===== Trainer/Admin guard helper =====
async function assertTrainerOrAdmin(ctx: {
  supabase: any;
  userId: string;
}) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", ["treinador", "admin"]);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.length) throw new Error("Forbidden: treinador required");
  return {
    isAdmin: roles.includes("admin"),
    isTrainer: roles.includes("treinador"),
  };
}
// Backwards compatible alias
const assertTrainer = assertTrainerOrAdmin;

// Ensure caller is admin, or the trainer assigned to this student.
async function assertCanManageStudent(
  ctx: { supabase: any; userId: string },
  studentId: string,
) {
  const { isAdmin } = await assertTrainerOrAdmin(ctx);
  if (isAdmin) return { isAdmin: true };
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("trainer_id")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.trainer_id !== ctx.userId) {
    throw new Error("Forbidden: aluno não atribuído a este treinador");
  }
  return { isAdmin: false };
}

// ===== Trainer: students =====

const listStudentsInput = z.object({
  search: z.string().max(120).optional(),
  page: z.number().int().min(1).max(1000).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  trainerId: z.string().uuid().optional(),
});

export const listStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listStudentsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertTrainerOrAdmin(context);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = context.supabase
      .from("profiles")
      .select("id,full_name,email,phone,active,created_at,trainer_id", {
        count: "exact",
      })
      .order("full_name");
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s}`);
    }
    if (isAdmin && data.trainerId) {
      q = q.eq("trainer_id", data.trainerId);
    } else if (!isAdmin) {
      q = q.eq("trainer_id", context.userId);
    } else {
      const { data: staffRoles } = await context.supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["treinador", "admin"]);
      const staffIds = Array.from(
        new Set((staffRoles ?? []).map((r: any) => r.user_id)),
      );
      if (staffIds.length) {
        q = q.not("id", "in", `(${staffIds.join(",")})`);
      }
    }
    const { data: rows, count } = await q.range(from, to);
    return { rows: rows ?? [], total: count ?? 0 };
  });

// ===== Admin: overview of trainers and their students =====
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: trainerRoles } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "treinador");
    const trainerIds = (trainerRoles ?? []).map((r: any) => r.user_id);
    const { data: trainers } = trainerIds.length
      ? await context.supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", trainerIds)
          .order("full_name")
      : { data: [] as any[] };

    const { data: staffRoles } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["treinador", "admin"]);
    const staffIds = Array.from(
      new Set((staffRoles ?? []).map((r: any) => r.user_id)),
    );

    let studentsQ = context.supabase
      .from("profiles")
      .select("id,full_name,email,trainer_id,active")
      .order("full_name");
    if (staffIds.length) {
      studentsQ = studentsQ.not("id", "in", `(${staffIds.join(",")})`);
    }
    const { data: students } = await studentsQ;

    const grouped = (trainers ?? []).map((t: any) => ({
      trainer: t,
      students: (students ?? []).filter((s: any) => s.trainer_id === t.id),
    }));
    const unassigned = (students ?? []).filter((s: any) => !s.trainer_id);
    return {
      trainers: grouped,
      unassigned,
      totalStudents: students?.length ?? 0,
    };
  });

const createStudentInput = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(200),
  phone: z.string().trim().max(40).optional(),
  trainer_id: z.string().uuid().optional(),
});

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createStudentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertTrainerOrAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar aluno");
    // Admin may assign to any trainer; trainer always owns own students
    const trainerId = isAdmin
      ? (data.trainer_id ?? null)
      : context.userId;
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        trainer_id: trainerId,
      })
      .eq("id", created.user.id);
    return { id: created.user.id };
  });

// ===== Admin: reassign a student to a trainer =====
export const assignStudentTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        trainerId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ trainer_id: data.trainerId })
      .eq("id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStudentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { studentId } = data;
    await assertCanManageStudent(context, studentId);
    const [
      { data: profile },
      { data: trainingPlan },
      { data: nutritionPlan },
      { data: actionPlan },
      { data: logbook },
    ] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", studentId).maybeSingle(),
      context.supabase
        .from("training_plans")
        .select("*")
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("nutrition_plans")
        .select("*")
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("action_plans")
        .select("*")
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("logbook_entries")
        .select("*")
        .eq("student_id", studentId)
        .order("exercise", { ascending: true })
        .order("entry_date", { ascending: true }),
    ]);

    const exercises = trainingPlan
      ? (
          await context.supabase
            .from("training_exercises")
            .select("*")
            .eq("plan_id", trainingPlan.id)
            .order("order_index")
        ).data ?? []
      : [];
    const meals = nutritionPlan
      ? (
          await context.supabase
            .from("meals")
            .select("*")
            .eq("plan_id", nutritionPlan.id)
            .order("order_index")
        ).data ?? []
      : [];
    const mealIds = meals.map((m: any) => m.id);
    const items = mealIds.length
      ? (
          await context.supabase
            .from("meal_items")
            .select("*")
            .in("meal_id", mealIds)
            .order("order_index")
        ).data ?? []
      : [];
    return { profile, trainingPlan, exercises, nutritionPlan, meals, items, actionPlan, logbook: logbook ?? [] };
  });

// ===== Trainer: save training =====

const exerciseInput = z.object({
  id: z.string().uuid().optional(),
  day_label: z.string().max(120).default(""),
  exercise_name: z.string().max(200).default(""),
  sets: z.string().max(40).nullable().optional(),
  reps: z.string().max(40).nullable().optional(),
  load: z.string().max(80).nullable().optional(),
  rest: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  gallery_video_id: z.string().uuid().nullable().optional(),
  order_index: z.number().int().default(0),
});

const saveTrainingInput = z.object({
  studentId: z.string().uuid(),
  planId: z.string().uuid().optional(),
  title: z.string().max(200).default(""),
  active: z.boolean().default(true),
  exercises: z.array(exerciseInput).max(500),
});

export const saveTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveTrainingInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManageStudent(context, data.studentId);
    const { supabase } = context;
    let planId = data.planId;
    if (planId) {
      await supabase
        .from("training_plans")
        .update({
          title: data.title,
          active: data.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId);
    } else {
      const { data: created, error } = await supabase
        .from("training_plans")
        .insert({
          student_id: data.studentId,
          title: data.title,
          active: data.active,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      planId = created.id;
    }
    await supabase.from("training_exercises").delete().eq("plan_id", planId);
    if (data.exercises.length) {
      const rows = data.exercises.map((e, i) => ({
        plan_id: planId,
        day_label: e.day_label,
        exercise_name: e.exercise_name,
        sets: e.sets ?? null,
        reps: e.reps ?? null,
        load: e.load ?? null,
        rest: e.rest ?? null,
        notes: e.notes ?? null,
        gallery_video_id: e.gallery_video_id ?? null,
        order_index: e.order_index ?? i,
      }));
      const { error } = await supabase.from("training_exercises").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { planId };
  });

// ===== Trainer: save nutrition =====

const itemInput = z.object({
  food_name: z.string().max(200).default(""),
  quantity: z.string().max(80).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  calories: z.number().nullable().optional(),
  protein: z.number().nullable().optional(),
  carbs: z.number().nullable().optional(),
  fat: z.number().nullable().optional(),
  order_index: z.number().int().default(0),
});

const mealInput = z.object({
  meal_name: z.string().max(120).default(""),
  meal_time: z.string().max(20).nullable().optional(),
  order_index: z.number().int().default(0),
  items: z.array(itemInput).max(100),
});

const saveNutritionInput = z.object({
  studentId: z.string().uuid(),
  planId: z.string().uuid().optional(),
  title: z.string().max(200).default(""),
  active: z.boolean().default(true),
  general_notes: z.string().max(4000).nullable().optional(),
  meals: z.array(mealInput).max(20),
});

export const saveNutritionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveNutritionInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManageStudent(context, data.studentId);
    const { supabase } = context;
    let planId = data.planId;
    if (planId) {
      await supabase
        .from("nutrition_plans")
        .update({
          title: data.title,
          active: data.active,
          general_notes: data.general_notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId);
    } else {
      const { data: created, error } = await supabase
        .from("nutrition_plans")
        .insert({
          student_id: data.studentId,
          title: data.title,
          active: data.active,
          general_notes: data.general_notes ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      planId = created.id;
    }
    // Cascade delete via meals
    await supabase.from("meals").delete().eq("plan_id", planId);
    for (let i = 0; i < data.meals.length; i++) {
      const m = data.meals[i];
      const { data: createdMeal, error: mErr } = await supabase
        .from("meals")
        .insert({
          plan_id: planId,
          meal_name: m.meal_name,
          meal_time: m.meal_time ?? null,
          order_index: m.order_index ?? i,
        })
        .select("id")
        .single();
      if (mErr) throw new Error(mErr.message);
      if (m.items.length) {
        const rows = m.items.map((it, j) => ({
          meal_id: createdMeal.id,
          food_name: it.food_name,
          quantity: it.quantity ?? null,
          notes: it.notes ?? null,
          calories: it.calories ?? null,
          protein: it.protein ?? null,
          carbs: it.carbs ?? null,
          fat: it.fat ?? null,
          order_index: it.order_index ?? j,
        }));
        const { error: iErr } = await supabase.from("meal_items").insert(rows);
        if (iErr) throw new Error(iErr.message);
      }
    }
    return { planId };
  });

// ===== Trainer: gallery CRUD =====

const galleryInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  muscle_group: z.string().trim().max(80).default(""),
  youtube_url: z.string().trim().url().max(500),
  description: z.string().max(2000).nullable().optional(),
});

export const saveGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => galleryInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertTrainer(context);
    const { id, ...payload } = data;
    if (id) {
      const { error } = await context.supabase
        .from("exercise_gallery")
        .update(payload)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: created, error } = await context.supabase
      .from("exercise_gallery")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertTrainer(context);
    const { error } = await context.supabase
      .from("exercise_gallery")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Plan PDFs =====

const planKind = z.enum(["training", "nutrition", "action"]);
const tableForKind = (k: "training" | "nutrition" | "action") =>
  k === "training" ? "training_plans" : k === "nutrition" ? "nutrition_plans" : "action_plans";
const defaultTitleForKind = (k: "training" | "nutrition" | "action") =>
  k === "training" ? "Treino" : k === "nutrition" ? "Plano nutricional" : "Plano de ação";

export const savePlanPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        kind: planKind,
        pdf_path: z.string().min(1).max(500),
        pdf_name: z.string().min(1).max(255),
        title: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageStudent(context, data.studentId);
    const { supabase } = context;
    const table = tableForKind(data.kind);
    const { data: existing } = await supabase
      .from(table)
      .select("id,pdf_path")
      .eq("student_id", data.studentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      student_id: data.studentId,
      title: data.title ?? defaultTitleForKind(data.kind),
      active: true,
      pdf_path: data.pdf_path,
      pdf_name: data.pdf_name,
      updated_at: new Date().toISOString(),
    };

    let oldPath: string | null = null;
    if (existing) {
      oldPath = existing.pdf_path ?? null;
      const { error } = await supabase.from(table).update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw new Error(error.message);
    }

    if (oldPath && oldPath !== data.pdf_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("plans").remove([oldPath]);
    }
    return { ok: true };
  });

export const getStudentPlanPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid(), kind: planKind }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageStudent(context, data.studentId);
    const table = tableForKind(data.kind);
    const { data: plan } = await context.supabase
      .from(table)
      .select("pdf_path,pdf_name")
      .eq("student_id", data.studentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan?.pdf_path) return { url: null, name: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("plans")
      .createSignedUrl(plan.pdf_path, 3600);
    return { url: signed?.signedUrl ?? null, name: plan.pdf_name };
  });

export const getMyPlanPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: planKind }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const table = tableForKind(data.kind);
    const { data: plan } = await supabase
      .from(table)
      .select("pdf_path,pdf_name,title")
      .eq("student_id", userId)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan?.pdf_path) return { url: null, name: null, title: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("plans")
      .createSignedUrl(plan.pdf_path, 3600);
    return { url: signed?.signedUrl ?? null, name: plan.pdf_name, title: plan.title };
  });

export const deletePlanPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid(), kind: planKind }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageStudent(context, data.studentId);
    const table = tableForKind(data.kind);
    const { data: plan } = await context.supabase
      .from(table)
      .select("id,pdf_path")
      .eq("student_id", data.studentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) return { ok: true };
    if (plan.pdf_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("plans").remove([plan.pdf_path]);
    }
    await context.supabase
      .from(table)
      .update({ pdf_path: null, pdf_name: null })
      .eq("id", plan.id);
    return { ok: true };
  });

// ===== Logbook =====

export const getMyLogbook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("logbook_entries")
      .select("*")
      .eq("student_id", context.userId)
      .order("exercise", { ascending: true })
      .order("entry_date", { ascending: true });
    return { rows: data ?? [] };
  });

const logbookEntryInput = z.object({
  id: z.string().uuid().optional(),
  exercise: z.string().trim().max(200).default(""),
  load: z.string().trim().max(80).default(""),
  reps: z.string().trim().max(80).default(""),
  entry_date: z.string().trim().max(10).default(""),
  order_index: z.number().int().default(0),
});

export const saveLogbookEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => logbookEntryInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const entryDate = data.entry_date || new Date().toISOString().split("T")[0];
    if (data.id) {
      const { error } = await supabase
        .from("logbook_entries")
        .update({
          exercise: data.exercise,
          load: data.load,
          reps: data.reps,
          entry_date: entryDate,
          order_index: data.order_index,
        })
        .eq("id", data.id)
        .eq("student_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("logbook_entries")
      .insert({
        student_id: userId,
        exercise: data.exercise,
        load: data.load,
        reps: data.reps,
        entry_date: entryDate,
        order_index: data.order_index,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteLogbookEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("logbook_entries")
      .delete()
      .eq("id", data.id)
      .eq("student_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Structured training plan (parsed XLSX) =====

const structuredPlanSchema = z.object({
  weeks: z.array(z.string()).max(20),
  blocks: z
    .array(
      z.object({
        name: z.string().max(60),
        day: z.string().max(60).nullable(),
        exercises: z
          .array(
            z.object({
              name: z.string().max(200),
              weeks: z.array(z.string().max(60)).max(20),
              note: z.string().max(500),
            }),
          )
          .max(200),
      }),
    )
    .max(20),
  abdomen: z
    .array(
      z.object({
        name: z.string().max(200),
        weeks: z.array(z.string().max(60)).max(20),
        note: z.string().max(500),
      }),
    )
    .max(50),
  cardio: z
    .array(
      z.object({
        name: z.string().max(200),
        weeks: z.array(z.string().max(60)).max(20),
        note: z.string().max(500),
      }),
    )
    .max(50),
  tips: z.array(z.string().max(1000)).max(50),
});

export const getMyStructuredTrainingPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("structured_training_plans")
      .select("plan,source_name,updated_at")
      .eq("student_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });

export const getStudentStructuredTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertTrainerOrAdmin(context);
    const { data: row } = await context.supabase
      .from("structured_training_plans")
      .select("plan,source_name,updated_at")
      .eq("student_id", data.studentId)
      .maybeSingle();
    return row ?? null;
  });

export const saveStructuredTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        sourceName: z.string().max(255),
        plan: structuredPlanSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertTrainerOrAdmin(context);
    const { error } = await context.supabase
      .from("structured_training_plans")
      .upsert(
        {
          student_id: data.studentId,
          source_name: data.sourceName,
          plan: data.plan,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStructuredTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertTrainerOrAdmin(context);
    const { error } = await context.supabase
      .from("structured_training_plans")
      .delete()
      .eq("student_id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Diet (parsed XLSX) =====
const dietItemSchema = z.object({
  alimento: z.string().max(200),
  quantidade: z.string().max(80),
  medida: z.string().max(80),
});
const dietMealSchema = z.object({
  nome: z.string().max(200),
  itens: z.array(dietItemSchema).max(100),
});
const dietSupplementSchema = z.object({
  nome: z.string().max(200),
  dose: z.string().max(80),
  horario: z.string().max(80),
});
const dietPlanSchema = z.object({
  suplementos: z.array(dietSupplementSchema).max(50),
  refeicoes: z.array(dietMealSchema).max(50),
  observacoes: z.string().max(4000).default(""),
});

export const getMyDiet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("diet_prescriptions")
      .select("data,source_name,observacoes,updated_at")
      .eq("student_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });

export const getStudentDiet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertTrainerOrAdmin(context);
    const { data: row } = await context.supabase
      .from("diet_prescriptions")
      .select("data,source_name,observacoes,updated_at")
      .eq("student_id", data.studentId)
      .maybeSingle();
    return row ?? null;
  });

export const saveDiet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        sourceName: z.string().max(255),
        plan: dietPlanSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertTrainerOrAdmin(context);
    const { error } = await context.supabase
      .from("diet_prescriptions")
      .upsert(
        {
          student_id: data.studentId,
          source_name: data.sourceName,
          observacoes: data.plan.observacoes ?? "",
          data: data.plan,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDiet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertTrainerOrAdmin(context);
    const { error } = await context.supabase
      .from("diet_prescriptions")
      .delete()
      .eq("student_id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Plano de Ação: geração via IA (gerador consolidado no Hub) =====
// Reaproveita o treino/dieta já estruturados (XLSX→JSON, no banco) + anamnese e
// fotos que o treinador sobe na hora. NÃO salva o plano nem mostra pro aluno:
// devolve o PlanData pro editor; o treinador revisa e baixa o PDF.
const generateActionPlanInput = z.object({
  studentId: z.string().uuid(),
  alunoNome: z.string().trim().min(1).max(200),
  cicloMeses: z.number().int().min(1).max(36).default(12),
  diaFeedback: z.string().trim().max(40).optional(),
  telefone: z.string().trim().max(40).optional(),
  anamnesePath: z.string().min(1).max(300),
  fotoFrentePath: z.string().min(1).max(300),
  fotoLadoPath: z.string().min(1).max(300),
  fotoCostasPath: z.string().min(1).max(300),
});

export const generateActionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => generateActionPlanInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManageStudent(context, data.studentId);

    // Todos os caminhos têm que estar dentro da pasta do próprio aluno.
    const prefix = `${data.studentId}/`;
    const paths = [
      data.anamnesePath,
      data.fotoFrentePath,
      data.fotoLadoPath,
      data.fotoCostasPath,
    ];
    for (const p of paths) {
      if (!p.startsWith(prefix)) throw new Error("Caminho de arquivo inválido.");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    async function downloadBuffer(path: string): Promise<Buffer> {
      const { data: blob, error } = await supabaseAdmin.storage
        .from("plans")
        .download(path);
      if (error || !blob) throw new Error(`Falha ao ler arquivo: ${path}`);
      return Buffer.from(await blob.arrayBuffer());
    }

    // Treino/dieta já estruturados (do upload de XLSX).
    const [{ data: trainingRow }, { data: dietRow }] = await Promise.all([
      context.supabase
        .from("structured_training_plans")
        .select("plan")
        .eq("student_id", data.studentId)
        .maybeSingle(),
      context.supabase
        .from("diet_prescriptions")
        .select("data")
        .eq("student_id", data.studentId)
        .maybeSingle(),
    ]);

    const { serializeTraining, serializeDiet } = await import(
      "@/lib/plano/serialize"
    );
    const treinoTexto = trainingRow?.plan
      ? serializeTraining(trainingRow.plan as never)
      : undefined;
    const dietaTexto = dietRow?.data
      ? serializeDiet(dietRow.data as never)
      : undefined;

    const [anamnesePdf, frente, lado, costas] = await Promise.all([
      downloadBuffer(data.anamnesePath),
      downloadBuffer(data.fotoFrentePath),
      downloadBuffer(data.fotoLadoPath),
      downloadBuffer(data.fotoCostasPath),
    ]);

    const { generateCopy, buildPlanData } = await import(
      "@/lib/plano/anthropic"
    );
    const inputs: GenerateInputs = {
      alunoNome: data.alunoNome,
      cicloMeses: data.cicloMeses,
      diaFeedback: data.diaFeedback,
      anamnesePdf,
      treinoTexto,
      dietaTexto,
      fotos: { frente, lado, costas },
      // salesContext (cruzamento por telefone) fica pra v2: precisa do funil/pg.
    };
    const copy = await generateCopy(inputs);
    const plan = buildPlanData(copy, inputs);

    // Limpa os arquivos temporários: já viraram bytes/data-uri no PlanData.
    await supabaseAdmin.storage
      .from("plans")
      .remove(paths)
      .catch(() => {});

    return { plan };
  });
