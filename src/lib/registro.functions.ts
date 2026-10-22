import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcScore, calculateStreak, canEditRegistroDate, prescribedMealNames, validRegistroDate, addRegistroDays, STREAK_THRESHOLD } from "@/lib/registro-rules";
export { STREAK_THRESHOLD } from "@/lib/registro-rules";
import { assertCanManageStudent } from "@/lib/squad.functions";

// ---------- helpers ----------
const dateSchema = z
  .string()
  .refine(validRegistroDate, "Data inválida")
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

function addDaysIsoLocal(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function yesterdaySP(): string {
  return addDaysIsoLocal(todaySP(), -1);
}

function isEditableDate(date: string): boolean { return canEditRegistroDate(date, todaySP()); }
function assertEditableDate(date: string) {
  if (!isEditableDate(date)) throw new Error("Você pode preencher hoje e os sete dias anteriores.");
}

export const PATENTES_GUERRA: Array<{ days: number; rank: string }> = [
  { days: 3, rank: "RECRUTA" },
  { days: 7, rank: "SOLDADO" },
  { days: 14, rank: "CABO" },
  { days: 30, rank: "SARGENTO" },
  { days: 60, rank: "TENENTE" },
  { days: 90, rank: "CAPITÃO" },
  { days: 180, rank: "MAJOR" },
  { days: 365, rank: "COMANDANTE ANTIFOFISTA" },
];

export const MILESTONES = [7, 30, 90, 180, 365];

async function ensureDailyLog(
  supabase: any,
  studentId: string,
  logDate: string,
): Promise<string> {
  assertEditableDate(logDate);
  const { error: insertError } = await supabase.from("daily_logs").upsert(
    { student_id: studentId, log_date: logDate },
    { onConflict: "student_id,log_date", ignoreDuplicates: true },
  );
  if (insertError) throw new Error(insertError.message);
  const { data: row, error } = await supabase.from("daily_logs").select("id")
    .eq("student_id", studentId).eq("log_date", logDate).single();
  if (error || !row) throw new Error(error?.message ?? "Registro não encontrado");
  return row.id;
}

async function recomputeScore(
  supabase: any,
  studentId: string,
  logId: string,
) {
  const [logResult, mealsResult, weightResult, profileResult, dietResult] =
    await Promise.all([
      supabase
        .from("daily_logs")
        .select("water_ml, trained, rest_day, log_date")
        .eq("id", logId)
        .single(),
      supabase
        .from("meal_checks")
        .select("done, rating, meal_name")
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
      supabase.from("diet_prescriptions").select("data").eq("student_id", studentId).maybeSingle(),
    ]);
  for (const result of [logResult, mealsResult, weightResult, profileResult, dietResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const log = logResult.data, meals = mealsResult.data, latestWeight = weightResult.data, profile = profileResult.data;
  const names = prescribedMealNames(dietResult.data?.data);

  // Water goal is anchored to the anamnese weight (initial_weight_kg) so that
  // logging a new daily weight does NOT shift the goal and therefore does not
  // affect the daily score / patente %.
  const weightKg =
    Number(latestWeight?.weight_kg ?? profile?.initial_weight_kg ?? 0) || 0;
  const goalWeightKg = Number(profile?.initial_weight_kg ?? 0) || 0;
  const coef = Number(profile?.water_ml_per_kg ?? 50) || 50;
  const goal = Math.round(goalWeightKg * coef);
  const ratings = (meals ?? [])
    .filter((m: any) => m.done && names.includes(m.meal_name))
    .map((m: any) => Number(m.rating) || 0);
  const score = calcScore({
    waterMl: log?.water_ml ?? 0,
    waterGoalMl: goal,
    trained: !!log?.trained,
    mealRatings: ratings,
    totalMeals: names.length,
    restDay: !!log?.rest_day,
  });
  const { error } = await supabase.from("daily_logs").update({ daily_score: score }).eq("id", logId);
  if (error) throw new Error(error.message);
  const day = await readRegistroDay(supabase, studentId, log.log_date);
  return { score, goal, weightKg, day };
}

// ---------- streak reconciliation ----------
type StreakState = {
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  shields: number;
  shield_progress: number;
  total_completed_days: number;
  last_milestone: number;
  new_milestone: number | null; // set when we just crossed a milestone
  shield_consumed_today: boolean;
};

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

async function reconcileStreak(
  supabase: any,
  studentId: string,
): Promise<StreakState> {
  // Fetch every page: long streaks must not be truncated at 400/1000 rows.
  const logs: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("daily_logs")
      .select("log_date,daily_score,rest_day").eq("student_id", studentId)
      .lte("log_date", todaySP()).order("log_date").range(offset, offset + 999);
    if (error) throw new Error(error.message);
    logs.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  const neutral = await readNeutralDays(supabase, studentId);
  const { data: prevStreak, error: prevError } = await supabase.from("streaks")
    .select("last_milestone,longest_streak").eq("student_id", studentId).maybeSingle();
  if (prevError) throw new Error(prevError.message);
  const prevMilestone = prevStreak?.last_milestone ?? 0;
  const calculated = calculateStreak(logs, neutral.map(d => d.log_date), todaySP());
  const { current_streak: current, shields, shield_progress: shieldProgress,
    total_completed_days: total, last_completed_date: lastCompleted } = calculated;
  const longest = Math.max(calculated.longest_streak, prevStreak?.longest_streak ?? 0);

  // Detect new milestone crossed since last save
  let newMilestone: number | null = null;
  for (const m of MILESTONES) {
    if (current >= m && prevMilestone < m) {
      newMilestone = m; // remember highest crossed
    }
  }
  // Keep last_milestone as-is when a new one was crossed, so the client can
  // show the celebration card until the user acknowledges via ackMilestone.
  const nextLastMilestone = newMilestone === null
    ? Math.max(
        prevMilestone,
        ...MILESTONES.filter((m) => current >= m),
        0,
      )
    : prevMilestone;

  const state: StreakState = {
    current_streak: current,
    longest_streak: longest,
    last_completed_date: lastCompleted,
    shields,
    shield_progress: shieldProgress,
    total_completed_days: total,
    last_milestone: nextLastMilestone,
    new_milestone: newMilestone,
    shield_consumed_today: false,
  };

  const { error: streakError } = await supabase.from("streaks").upsert(
    {
      student_id: studentId,
      current_streak: current,
      longest_streak: longest,
      last_completed_date: lastCompleted,
      shields,
      shield_progress: shieldProgress,
      total_completed_days: total,
      last_milestone: nextLastMilestone,
    },
    { onConflict: "student_id" },
  );

  if (streakError) throw new Error(streakError.message);
  return state;
}


export function getPatenteGuerra(streak: number): {
  current: string;
  next: { rank: string; days: number } | null;
  daysToNext: number;
  progress: number; // 0..1 to next
} {
  if (streak < 3) {
    const next = PATENTES_GUERRA[0];
    return {
      current: "EM FORMAÇÃO",
      next,
      daysToNext: next.days - streak,
      progress: streak / next.days,
    };
  }
  let currentIdx = 0;
  for (let i = 0; i < PATENTES_GUERRA.length; i++) {
    if (streak >= PATENTES_GUERRA[i].days) currentIdx = i;
  }
  const current = PATENTES_GUERRA[currentIdx].rank;
  const next = PATENTES_GUERRA[currentIdx + 1] ?? null;
  if (!next) {
    return { current, next: null, daysToNext: 0, progress: 1 };
  }
  const base = PATENTES_GUERRA[currentIdx].days;
  const daysToNext = next.days - streak;
  const progress = (streak - base) / (next.days - base);
  return { current, next, daysToNext, progress: Math.max(0, Math.min(1, progress)) };
}


async function readNeutralDays(supabase: any, studentId: string): Promise<{ log_date: string }[]> {
  const rows: { log_date: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("registro_neutral_days").select("log_date")
      .eq("student_id", studentId).eq("enabled", true).order("log_date").range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}

async function readRegistroDay(supabase: any, studentId: string, logDate: string) {
    // profile + latest weight
    const [{ data: profile }, { data: latestWeight }, { data: diet }, { data: crm }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,full_name,birth_date,height_cm,initial_weight_kg,water_ml_per_kg",
          )
          .eq("id", studentId)
          .maybeSingle(),
        supabase
          .from("weight_entries")
          .select("weight_kg,entry_date")
          .eq("student_id", studentId)
          .order("entry_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("diet_prescriptions")
          .select("data")
          .eq("student_id", studentId)
          .maybeSingle(),
        supabase
          .from("student_crm")
          .select("proximo_checkin")
          .eq("student_id", studentId)
          .maybeSingle(),
      ]);

    const weightKg =
      Number(latestWeight?.weight_kg ?? profile?.initial_weight_kg ?? 0) || 0;
    const goalWeightKg = Number(profile?.initial_weight_kg ?? 0) || 0;
    const coef = Number(profile?.water_ml_per_kg ?? 50) || 50;
    // Meta de água ancorada no peso da anamnese — o peso diário não afeta o %.
    const waterGoalMl = Math.round(goalWeightKg * coef);

    const mealNames = prescribedMealNames(diet?.data);

    // Ensure daily log exists only within the retroactive edit window.
    let logId: string | null = null;
    let log: any = null;
    if (isEditableDate(logDate)) {
      logId = await ensureDailyLog(supabase, studentId, logDate);
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
            daily_log_id: logId,
            meal_name: name,
            order_index: idx,
          }))
          .filter((r) => !have.has(r.meal_name));
        if (missing.length) {
          const { error } = await supabase.from("meal_checks").upsert(missing,
            { onConflict: "daily_log_id,meal_name", ignoreDuplicates: true });
          if (error) throw new Error(error.message);
        }
      }
    } else {
      const { data: l } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("student_id", studentId)
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

    const neutralDays = await readNeutralDays(supabase, studentId);
    // Reconcile streak on every open. Reads the freshly written log.
    const streak = await reconcileStreak(supabase, studentId);

    return {
      logDate,
      isToday: logDate === todaySP(),
      isYesterday: logDate === yesterdaySP(),
      isEditable: isEditableDate(logDate),
      profile,
      weightKg,
      waterGoalMl,
      waterMlPerKg: coef,
      log: log ?? {
        water_ml: 0,
        trained: false,
        rest_day: false,
        daily_score: 0,
      },
      meals: (meals ?? []).filter((m: any) => mealNames.includes(m.meal_name)) as Array<{
        id: string;
        meal_name: string;
        done: boolean;
        rating: number;
        order_index: number;
      }>,
      dietMealNames: mealNames,
      neutralDays,
      isNeutralDay: neutralDays.some(d => d.log_date === logDate),
      streak,
      proximoCheckin: ((crm as any)?.proximo_checkin as string | null) ?? null,
      patente: getPatenteGuerra(streak.current_streak),
    };

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

    return readRegistroDay(supabase, userId, logDate);
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
    const { error } = await supabase.rpc("add_registro_water", { p_log_id: logId, p_delta: data.deltaMl });
    if (error) throw new Error(error.message);
    const s = await recomputeScore(supabase, userId, logId);
    return { water_ml: s.day.log.water_ml, ...s };
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
    const { error } = await supabase
      .from("daily_logs")
      .update({ water_ml: data.waterMl })
      .eq("id", logId);
    if (error) throw new Error(error.message);
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
    const { error } = await supabase
      .from("daily_logs")
      .update({ trained: data.trained })
      .eq("id", logId);
    if (error) throw new Error(error.message);
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
    const logDate = data.date ?? todaySP();
    assertEditableDate(logDate);
    const { data: owned, error: ownedError } = await supabase.from("meal_checks")
      .select("daily_log_id").eq("id", data.mealCheckId).single();
    if (ownedError || !owned) throw new Error("Refeição não encontrada");
    const { data: log, error: logError } = await supabase.from("daily_logs")
      .select("log_date,student_id").eq("id", owned.daily_log_id).single();
    if (logError || log?.student_id !== userId || log?.log_date !== logDate) throw new Error("Refeição inválida para este dia");
    const patch: any = {};
    if (data.done !== undefined) patch.done = data.done;
    if (data.rating !== undefined) patch.rating = data.rating;
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
    assertEditableDate(entryDate);
    const { error } = await supabase.from("weight_entries").upsert(
      {
        student_id: userId,
        entry_date: entryDate,
        weight_kg: data.weightKg,
      },
      { onConflict: "student_id,entry_date" },
    );
    if (error) throw new Error(error.message);
    // Recompute and return the edited date; water goal remains anchored to anamnese.
    const todayId = await ensureDailyLog(supabase, userId, entryDate);
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
    // Explicit role guard: only the assigned trainer or an admin can edit
    // these scoring-relevant fields. Students must not self-serve here.
    await assertCanManageStudent(context, data.studentId);
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

// ---------- rest day toggle ----------
export const setRestDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        restDay: z.boolean(),
        date: dateSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const logDate = data.date ?? todaySP();
    const logId = await ensureDailyLog(supabase, userId, logDate);
    const { error } = await supabase
      .from("daily_logs")
      .update({ rest_day: data.restDay })
      .eq("id", logId);
    if (error) throw new Error(error.message);
    const s = await recomputeScore(supabase, userId, logId);
    return { rest_day: data.restDay, ...s };
  });

// Mark a milestone card as seen (so it stops popping up).
export const ackMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ milestone: z.number().int().min(1).max(3650) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("streaks")
      .update({ last_milestone: data.milestone })
      .eq("student_id", userId);
    return { ok: true };
  });

// ---------- trainer view: student adherence snapshot ----------
export const getStudentAdherence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageStudent(context, data.studentId);
    const { supabase } = context;
    const studentId = data.studentId;
    const today = todaySP();
    const since = addDaysIso(today, -29);

    const [
      { data: profile },
      { data: latestWeight },
      { data: logs },
      { data: streakRow },
      { data: diet },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("initial_weight_kg,water_ml_per_kg")
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("weight_entries")
        .select("weight_kg,entry_date")
        .eq("student_id", studentId)
        .order("entry_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("daily_logs")
        .select("id,log_date,water_ml,trained,rest_day,daily_score")
        .eq("student_id", studentId)
        .gte("log_date", since)
        .lte("log_date", today)
        .order("log_date", { ascending: true }),
      supabase
        .from("streaks")
        .select("current_streak,longest_streak,shields,total_completed_days")
        .eq("student_id", studentId)
        .maybeSingle(),
      supabase
        .from("diet_prescriptions")
        .select("data")
        .eq("student_id", studentId)
        .maybeSingle(),
    ]);

    const weightKg =
      Number(latestWeight?.weight_kg ?? profile?.initial_weight_kg ?? 0) || 0;
    const goalWeightKg = Number(profile?.initial_weight_kg ?? 0) || 0;
    const coef = Number(profile?.water_ml_per_kg ?? 50) || 50;
    const waterGoalMl = Math.round(goalWeightKg * coef);

    const logIds = (logs ?? []).map((l: any) => l.id);
    const { data: mealChecks } = logIds.length
      ? await supabase
          .from("meal_checks")
          .select("daily_log_id,done,rating")
          .in("daily_log_id", logIds)
      : { data: [] as any[] };

    // Aggregate per-day meal stats.
    const mealsByLog = new Map<string, { done: number; total: number; ratingSum: number; ratingCount: number }>();
    for (const mc of mealChecks ?? []) {
      const cur = mealsByLog.get(mc.daily_log_id) ?? {
        done: 0,
        total: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
      cur.total += 1;
      if (mc.done) {
        cur.done += 1;
        if (mc.rating && mc.rating > 0) {
          cur.ratingSum += Number(mc.rating);
          cur.ratingCount += 1;
        }
      }
      mealsByLog.set(mc.daily_log_id, cur);
    }

    const days = (logs ?? []).map((l: any) => {
      const meals = mealsByLog.get(l.id) ?? {
        done: 0,
        total: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
      return {
        date: l.log_date as string,
        water_ml: Number(l.water_ml) || 0,
        water_pct:
          waterGoalMl > 0
            ? Math.min(1, (Number(l.water_ml) || 0) / waterGoalMl)
            : 0,
        trained: !!l.trained,
        rest_day: !!l.rest_day,
        score: Number(l.daily_score) || 0,
        meals_done: meals.done,
        meals_total: meals.total,
        meal_avg_rating: meals.ratingCount
          ? meals.ratingSum / meals.ratingCount
          : 0,
      };
    });

    // 30-day averages (only over days with logs).
    const n = days.length || 1;
    const avgScore = days.reduce((a, d) => a + d.score, 0) / n;
    const avgWaterPct = days.reduce((a, d) => a + d.water_pct, 0) / n;
    const trainingDays = days.filter((d) => !d.rest_day).length || 1;
    const trainedCount = days.filter((d) => d.trained && !d.rest_day).length;
    const trainingPct = trainedCount / trainingDays;
    const mealDoneTotal = days.reduce((a, d) => a + d.meals_done, 0);
    const mealTotalTotal = days.reduce((a, d) => a + d.meals_total, 0);
    const mealAdherence = mealTotalTotal ? mealDoneTotal / mealTotalTotal : 0;
    const ratingDays = days.filter((d) => d.meal_avg_rating > 0);
    const avgMealRating = ratingDays.length
      ? ratingDays.reduce((a, d) => a + d.meal_avg_rating, 0) / ratingDays.length
      : 0;

    const todayEntry = days.find((d) => d.date === today) ?? null;
    const dietMealCount = Array.isArray((diet?.data as any)?.refeicoes)
      ? ((diet!.data as any).refeicoes as any[]).length
      : 0;

    return {
      profile,
      weightKg,
      waterGoalMl,
      waterMlPerKg: coef,
      dietMealCount,
      today: todayEntry,
      days,
      averages: {
        score: Math.round(avgScore * 10) / 10,
        waterPct: Math.round(avgWaterPct * 100) / 100,
        trainingPct: Math.round(trainingPct * 100) / 100,
        mealAdherence: Math.round(mealAdherence * 100) / 100,
        mealRating: Math.round(avgMealRating * 10) / 10,
      },
      streak: {
        current: streakRow?.current_streak ?? 0,
        longest: streakRow?.longest_streak ?? 0,
        shields: streakRow?.shields ?? 0,
        total: streakRow?.total_completed_days ?? 0,
      },
    };
  });

// ---------- trainer: action plan inputs (files persistence) ----------
export const getActionPlanInputs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageStudent(context, data.studentId);
    const { data: row } = await context.supabase
      .from("action_plan_inputs")
      .select("*")
      .eq("student_id", data.studentId)
      .maybeSingle();
    if (!row) return { inputs: null, signed: null };
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    async function sign(path: string | null) {
      if (!path) return null;
      const { data: s } = await supabaseAdmin.storage
        .from("plans")
        .createSignedUrl(path, 3600);
      return s?.signedUrl ?? null;
    }
    const signed = {
      anamnese: await sign(row.anamnese_path),
      frente: await sign(row.foto_frente_path),
      lado: await sign(row.foto_lado_path),
      costas: await sign(row.foto_costas_path),
    };
    return { inputs: row, signed };
  });

export const saveActionPlanInputs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        anamnese_path: z.string().max(300).nullable().optional(),
        anamnese_name: z.string().max(255).nullable().optional(),
        foto_frente_path: z.string().max(300).nullable().optional(),
        foto_lado_path: z.string().max(300).nullable().optional(),
        foto_costas_path: z.string().max(300).nullable().optional(),
        ciclo_meses: z.number().int().min(1).max(36).optional(),
        dia_feedback: z.string().max(40).nullable().optional(),
        telefone: z.string().max(40).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageStudent(context, data.studentId);
    // Todos os caminhos têm que estar dentro da pasta do próprio aluno.
    const prefix = `${data.studentId}/`;
    for (const key of [
      "anamnese_path",
      "foto_frente_path",
      "foto_lado_path",
      "foto_costas_path",
    ] as const) {
      const p = data[key];
      if (typeof p === "string" && p.length > 0 && !p.startsWith(prefix)) {
        throw new Error("Caminho de arquivo inválido.");
      }
    }
    const patch: any = { student_id: data.studentId };
    for (const k of [
      "anamnese_path",
      "anamnese_name",
      "foto_frente_path",
      "foto_lado_path",
      "foto_costas_path",
      "ciclo_meses",
      "dia_feedback",
      "telefone",
    ] as const) {
      if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
    }
    patch.updated_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("action_plan_inputs")
      .upsert(patch, { onConflict: "student_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getNeutralDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studentId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const studentId = data.studentId ?? context.userId;
    if (studentId !== context.userId) await assertCanManageStudent(context, studentId);
    return { days: await readNeutralDays(context.supabase, studentId) };
  });

export const setNeutralDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studentId: z.string().uuid().optional(),
    startDate: dateSchema, endDate: dateSchema, enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const studentId = data.studentId ?? context.userId;
    if (studentId !== context.userId) await assertCanManageStudent(context, studentId);
    if (data.endDate < data.startDate) throw new Error("A data final deve ser igual ou posterior à inicial.");
    const rows = [];
    for (let date = data.startDate; date <= data.endDate; date = addRegistroDays(date, 1)) {
      rows.push({ student_id: studentId, log_date: date, enabled: data.enabled,
        created_by: context.userId, updated_at: new Date().toISOString() });
    }
    // Chunk the payload, without limiting the dates a student can regularize as travel.
    for (let offset = 0; offset < rows.length; offset += 500) {
      const { error } = await context.supabase.from("registro_neutral_days")
        .upsert(rows.slice(offset, offset + 500), { onConflict: "student_id,log_date" });
      if (error) throw new Error(error.message);
    }
    // Assigned trainers can schedule neutral days but cannot write streak rows via RLS.
    // The privileged recalculation is only reached after the ownership/role check above.
    if (studentId !== context.userId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await reconcileStreak(supabaseAdmin, studentId);
    } else await reconcileStreak(context.supabase, studentId);
    return { days: await readNeutralDays(context.supabase, studentId) };
  });
