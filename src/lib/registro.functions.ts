import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid date")
  .default(() => todaySP());

function todaySP(): string {
  // yyyy-mm-dd in America/Sao_Paulo
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function calcScore(input: {
  waterMl: number;
  waterGoalMl: number;
  trained: boolean;
  mealRatings: number[]; // 0..5 for meals marked done
}) {
  const waterPct =
    input.waterGoalMl > 0
      ? Math.min(input.waterMl / input.waterGoalMl, 1)
      : 0;
  const trainingPct = input.trained ? 1 : 0;
  const mealPct = input.mealRatings.length
    ? input.mealRatings.reduce((a, b) => a + b, 0) /
      (input.mealRatings.length * 5)
    : 0;
  const score = waterPct * 30 + trainingPct * 25 + mealPct * 45;
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

async function ensureDailyLog(
  supabase: any,
  studentId: string,
  logDate: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("daily_logs")
    .select("id")
    .eq("student_id", studentId)
    .eq("log_date", logDate)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase
    .from("daily_logs")
    .insert({ student_id: studentId, log_date: logDate })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

async function recomputeScore(
  supabase: any,
  studentId: string,
  logId: string,
) {
  const [{ data: log }, { data: meals }, { data: latestWeight }, { data: profile }] =
    await Promise.all([
      supabase
        .from("daily_logs")
        .select("water_ml, trained")
        .eq("id", logId)
        .single(),
      supabase
        .from("meal_checks")
        .select("done, rating")
        .eq("daily_log_id", logId),
      supabase
        .from("weight_entries")
        .select("weight_kg")
        .eq("student_id", studentId)
        .order("entry_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("initial_weight_kg, water_ml_per_kg")
        .eq("id", studentId)
        .maybeSingle(),
    ]);

  const weightKg =
    Number(latestWeight?.weight_kg ?? profile?.initial_weight_kg ?? 0) || 0;
  const coef = Number(profile?.water_ml_per_kg ?? 50) || 50;
  const goal = Math.round(weightKg * coef);
  const ratings = (meals ?? [])
    .filter((m: any) => m.done)
    .map((m: any) => Number(m.rating) || 0);
  const score = calcScore({
    waterMl: log?.water_ml ?? 0,
    waterGoalMl: goal,
    trained: !!log?.trained,
    mealRatings: ratings,
  });
  await supabase.from("daily_logs").update({ daily_score: score }).eq("id", logId);
  return { score, goal, weightKg };
}

// ---------- reads ----------
export const getMyDayRegistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ date: dateSchema.optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const logDate = data.date ?? todaySP();

    // profile + latest weight
    const [{ data: profile }, { data: latestWeight }, { data: diet }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,full_name,birth_date,height_cm,initial_weight_kg,water_ml_per_kg",
          )
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("weight_entries")
          .select("weight_kg,entry_date")
          .eq("student_id", userId)
          .order("entry_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("diet_prescriptions")
          .select("data")
          .eq("student_id", userId)
          .maybeSingle(),
      ]);

    const weightKg =
      Number(latestWeight?.weight_kg ?? profile?.initial_weight_kg ?? 0) || 0;
    const coef = Number(profile?.water_ml_per_kg ?? 50) || 50;
    const waterGoalMl = Math.round(weightKg * coef);

    // meal names from active diet
    const mealNames: string[] = Array.isArray(
      (diet?.data as any)?.refeicoes,
    )
      ? ((diet!.data as any).refeicoes as any[])
          .map((m: any) => String(m?.nome ?? "").trim())
          .filter((n) => n.length > 0)
      : [];

    // ensure daily log exists for the date (only for TODAY, not for history browsing)
    let logId: string | null = null;
    let log: any = null;
    if (logDate === todaySP()) {
      logId = await ensureDailyLog(supabase, userId, logDate);
      const { data: l } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("id", logId)
        .single();
      log = l;
      // seed meal_checks for the day using diet meal names
      if (mealNames.length) {
        const { data: existing } = await supabase
          .from("meal_checks")
          .select("meal_name")
          .eq("daily_log_id", logId);
        const have = new Set(
          (existing ?? []).map((r: any) => String(r.meal_name)),
        );
        const missing = mealNames
          .map((name, idx) => ({
            daily_log_id: logId!,
            meal_name: name,
            order_index: idx,
          }))
          .filter((r) => !have.has(r.meal_name));
        if (missing.length) {
          await supabase.from("meal_checks").insert(missing);
        }
      }
    } else {
      const { data: l } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("student_id", userId)
        .eq("log_date", logDate)
        .maybeSingle();
      log = l;
      logId = l?.id ?? null;
    }

    const { data: meals } = logId
      ? await supabase
          .from("meal_checks")
          .select("*")
          .eq("daily_log_id", logId)
          .order("order_index")
      : { data: [] };

    return {
      logDate,
      isToday: logDate === todaySP(),
      profile,
      weightKg,
      waterGoalMl,
      waterMlPerKg: coef,
      log: log ?? {
        water_ml: 0,
        trained: false,
        daily_score: 0,
      },
      meals: (meals ?? []) as Array<{
        id: string;
        meal_name: string;
        done: boolean;
        rating: number;
        order_index: number;
      }>,
      dietMealNames: mealNames,
    };
  });

export const getMyWeightHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("weight_entries")
      .select("id, entry_date, weight_kg")
      .eq("student_id", context.userId)
      .order("entry_date", { ascending: true })
      .limit(365);
    return { entries: data ?? [] };
  });

export const getMyRegistroHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("daily_logs")
      .select("id, log_date, water_ml, trained, daily_score")
      .eq("student_id", context.userId)
      .order("log_date", { ascending: false })
      .limit(30);
    return { rows: data ?? [] };
  });

// ---------- writes ----------
export const addWater = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        deltaMl: z.number().int().min(-5000).max(5000),
        date: dateSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const logDate = data.date ?? todaySP();
    const logId = await ensureDailyLog(supabase, userId, logDate);
    const { data: cur } = await supabase
      .from("daily_logs")
      .select("water_ml")
      .eq("id", logId)
      .single();
    const next = Math.max(0, Math.min(20000, (cur?.water_ml ?? 0) + data.deltaMl));
    await supabase.from("daily_logs").update({ water_ml: next }).eq("id", logId);
    const s = await recomputeScore(supabase, userId, logId);
    return { water_ml: next, ...s };
  });

export const setWater = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        waterMl: z.number().int().min(0).max(20000),
        date: dateSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const logDate = data.date ?? todaySP();
    const logId = await ensureDailyLog(supabase, userId, logDate);
    await supabase
      .from("daily_logs")
      .update({ water_ml: data.waterMl })
      .eq("id", logId);
    const s = await recomputeScore(supabase, userId, logId);
    return { water_ml: data.waterMl, ...s };
  });

export const setTrained = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        trained: z.boolean(),
        date: dateSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const logDate = data.date ?? todaySP();
    const logId = await ensureDailyLog(supabase, userId, logDate);
    await supabase
      .from("daily_logs")
      .update({ trained: data.trained })
      .eq("id", logId);
    const s = await recomputeScore(supabase, userId, logId);
    return { trained: data.trained, ...s };
  });

export const upsertMealCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mealCheckId: z.string().uuid(),
        done: z.boolean().optional(),
        rating: z.number().int().min(0).max(5).optional(),
        date: dateSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: any = {};
    if (data.done !== undefined) patch.done = data.done;
    if (data.rating !== undefined) patch.rating = data.rating;
    if (!Object.keys(patch).length) return { ok: true };
    const { data: mc, error } = await supabase
      .from("meal_checks")
      .update(patch)
      .eq("id", data.mealCheckId)
      .select("daily_log_id")
      .single();
    if (error) throw new Error(error.message);
    const s = await recomputeScore(supabase, userId, mc.daily_log_id);
    return { ok: true, ...s };
  });

export const upsertWeightEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        weightKg: z.number().min(20).max(400),
        date: dateSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const entryDate = data.date ?? todaySP();
    const { error } = await supabase.from("weight_entries").upsert(
      {
        student_id: userId,
        entry_date: entryDate,
        weight_kg: data.weightKg,
      },
      { onConflict: "student_id,entry_date" },
    );
    if (error) throw new Error(error.message);
    // recompute today's score because goal depends on weight
    const todayId = await ensureDailyLog(supabase, userId, todaySP());
    const s = await recomputeScore(supabase, userId, todayId);
    return { ok: true, ...s };
  });

// ---------- trainer: adjust anamnese ----------
export const saveStudentAnamnese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        birth_date: z.string().nullable().optional(),
        height_cm: z.number().min(50).max(260).nullable().optional(),
        initial_weight_kg: z.number().min(20).max(400).nullable().optional(),
        water_ml_per_kg: z.number().int().min(20).max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // trainer/admin can update their own students; RLS on profiles enforces this
    const patch: any = {};
    if (data.birth_date !== undefined) patch.birth_date = data.birth_date;
    if (data.height_cm !== undefined) patch.height_cm = data.height_cm;
    if (data.initial_weight_kg !== undefined)
      patch.initial_weight_kg = data.initial_weight_kg;
    if (data.water_ml_per_kg !== undefined)
      patch.water_ml_per_kg = data.water_ml_per_kg;
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
