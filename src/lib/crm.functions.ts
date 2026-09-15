import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildPanelRow,
  crmAssertStudent,
  crmRoles,
  fetchAll,
  maxIso,
  type PanelRow,
} from "@/lib/crm-data";
import { computeAlerts } from "@/lib/crm-alerts";
import { addDaysIso, todayInBrasilia } from "@/lib/tz";

export const getTrainerPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await crmRoles(context);
    const today = todayInBrasilia();
    const since30 = addDaysIso(today, -29);
    const since7 = addDaysIso(today, -6);

    let studentsQ = supabase
      .from("profiles")
      .select("id,full_name,email,trainer_id")
      .order("full_name");
    if (!isAdmin) {
      studentsQ = studentsQ.eq("trainer_id", userId);
    } else {
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["treinador", "admin"]);
      const staffIds = Array.from(
        new Set((staffRoles ?? []).map((r: any) => r.user_id)),
      );
      if (staffIds.length) {
        studentsQ = studentsQ.not("id", "in", `("${staffIds.join('","')}")`);
      }
    }
    const { data: students, error: studentsError } = await studentsQ;
    if (studentsError) throw new Error(studentsError.message);
    const ids = (students ?? []).map((s: any) => s.id);

    const trainerNames = new Map<string, string>();
    if (isAdmin) {
      const trainerIds = Array.from(
        new Set(
          (students ?? [])
            .map((s: any) => s.trainer_id as string | null)
            .filter((v: string | null): v is string => Boolean(v)),
        ),
      );
      if (trainerIds.length) {
        const { data: trainerProfiles } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", trainerIds);
        for (const t of (trainerProfiles ?? []) as any[]) {
          trainerNames.set(t.id, t.full_name || t.email || "(sem nome)");
        }
      }
    }
    const trainersList: { id: string; full_name: string }[] = Array.from(
      trainerNames.entries(),
    )
      .map(([id, full_name]) => ({ id, full_name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    if (!ids.length)
      return { rows: [] as PanelRow[], today, isAdmin: Boolean(isAdmin), trainers: trainersList };


    const [logs, weights, crms, notes, streaks, structured, trainingPlans, diets] =
      await Promise.all([
        fetchAll((from, to) =>
          supabase
            .from("daily_logs")
            .select("student_id,log_date,daily_score")
            .gte("log_date", since30)
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("weight_entries")
            .select("student_id,entry_date")
            .gte("entry_date", since30)
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase.from("student_crm").select("*").range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("student_notes")
            .select("student_id,data")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("streaks")
            .select("student_id,current_streak")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("structured_training_plans")
            .select("student_id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("training_plans")
            .select("student_id,active")
            .eq("active", true)
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("diet_prescriptions")
            .select("student_id")
            .range(from, to),
        ),
      ]);

    const rows: PanelRow[] = (students ?? []).map((s: any) => {
      const myLogs = logs.filter((l) => l.student_id === s.id);
      const lastLog = myLogs.reduce<string | null>(
        (acc, l) => maxIso(acc, l.log_date),
        null,
      );
      const lastWeight = weights
        .filter((w) => w.student_id === s.id)
        .reduce<string | null>((acc, w) => maxIso(acc, w.entry_date), null);
      const week = myLogs.filter((l) => l.log_date >= since7);
      const adesao7 = week.length
        ? week.reduce((sum, l) => sum + Number(l.daily_score ?? 0), 0) / week.length
        : null;
      const lastNote = notes
        .filter((n) => n.student_id === s.id)
        .reduce<string | null>((acc, n) => maxIso(acc, n.data), null);
      return {
        ...buildPanelRow(
          { id: s.id, full_name: s.full_name, email: s.email },
          {
            crm: crms.find((c) => c.student_id === s.id) ?? null,
            lastActivity: maxIso(lastLog, lastWeight),
            lastFeedback: lastNote,
            adesao7,
            streak:
              Number(
                streaks.find((st) => st.student_id === s.id)?.current_streak ?? 0,
              ) || 0,
            hasPlan:
              structured.some((p) => p.student_id === s.id) ||
              trainingPlans.some((p) => p.student_id === s.id) ||
              diets.some((p) => p.student_id === s.id),
          },
          today,
        ),
        trainer_id: (s.trainer_id as string | null) ?? null,
        trainer_name: s.trainer_id ? (trainerNames.get(s.trainer_id) ?? null) : null,
      };
    });

    rows.sort((a, b) => b.urgencia - a.urgencia || a.full_name.localeCompare(b.full_name));
    return {
      rows,
      today,
      isAdmin,
      trainers: isAdmin
        ? Array.from(trainerNames.entries())
            .map(([id, full_name]) => ({ id, full_name }))
            .sort((a, b) => a.full_name.localeCompare(b.full_name))
        : [],
    };
  });


export const getStudentBordo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await crmAssertStudent(context, data.studentId);
    const { supabase } = context;
    const studentId = data.studentId;
    const today = todayInBrasilia();
    const since7 = addDaysIso(today, -6);
    const since30 = addDaysIso(today, -29);

    const [
      { data: crm },
      { data: notes },
      { data: logs },
      { data: weight },
      { data: streak },
      { data: structured },
      { data: trainingPlan },
      { data: diet },
    ] = await Promise.all([
      supabase.from("student_crm").select("*").eq("student_id", studentId).maybeSingle(),
      supabase
        .from("student_notes")
        .select("*")
        .eq("student_id", studentId)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("daily_logs")
        .select("log_date,daily_score")
        .eq("student_id", studentId)
        .gte("log_date", since30)
        .order("log_date", { ascending: false }),
      supabase
        .from("weight_entries")
        .select("weight_kg,entry_date")
        .eq("student_id", studentId)
        .order("entry_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("streaks")
        .select("current_streak,longest_streak,shields")
        .eq("student_id", studentId)
        .maybeSingle(),
      supabase
        .from("structured_training_plans")
        .select("student_id")
        .eq("student_id", studentId)
        .maybeSingle(),
      supabase
        .from("training_plans")
        .select("id")
        .eq("student_id", studentId)
        .eq("active", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("diet_prescriptions")
        .select("student_id")
        .eq("student_id", studentId)
        .maybeSingle(),
    ]);

    const allLogs = logs ?? [];
    const week = allLogs.filter((l: any) => l.log_date >= since7);
    const adesao7 = week.length
      ? week.reduce((s: number, l: any) => s + Number(l.daily_score ?? 0), 0) / week.length
      : null;
    const adesao30 = allLogs.length
      ? allLogs.reduce((s: number, l: any) => s + Number(l.daily_score ?? 0), 0) /
        allLogs.length
      : null;
    const lastActivity = maxIso(
      allLogs[0]?.log_date ?? null,
      weight?.entry_date ?? null,
    );
    const lastNote = (notes ?? [])[0]?.data ?? null;
    const hasPlan = Boolean(structured || trainingPlan || diet);

    const alerts = computeAlerts(
      {
        lastActivity,
        lastFeedback: lastNote,
        adesao7,
        proximoCheckin: (crm as any)?.proximo_checkin ?? null,
        hasPlan,
      },
      today,
    );

    return {
      today,
      crm: crm ?? null,
      notes: notes ?? [],
      alerts,
      resumo: {
        streak: Number(streak?.current_streak ?? 0) || 0,
        longest: Number(streak?.longest_streak ?? 0) || 0,
        shields: Number(streak?.shields ?? 0) || 0,
        adesao7,
        adesao30,
        lastWeight: weight ? Number(weight.weight_kg) : null,
        lastWeightDate: weight?.entry_date ?? null,
        lastActivity,
        hasPlan,
      },
    };
  });

export const saveStudentCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        objetivo: z.string().max(2000).nullable().optional(),
        restricoes: z.string().max(2000).nullable().optional(),
        plano_tipo: z.enum(["mensal", "trimestral", "semestral"]).nullable().optional(),
        data_inicio: z.string().max(10).nullable().optional(),
        proximo_checkin: z.string().max(10).nullable().optional(),
        status: z
          .enum([
            "ativo",
            "aguardando_checkin",
            "aguardando_resposta",
            "plano_a_montar",
          ])
          .optional(),
        whatsapp_grupo_url: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await crmAssertStudent(context, data.studentId);
    const url = data.whatsapp_grupo_url?.trim() || null;
    if (url && !/^https?:\/\//i.test(url)) {
      throw new Error("O link do grupo deve começar com https://");
    }
    const { studentId, ...rest } = data;
    const payload: Record<string, unknown> = { student_id: studentId };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) payload[k] = v === "" ? null : v;
    }
    if (url !== undefined) payload["whatsapp_grupo_url"] = url;
    const { error } = await context.supabase
      .from("student_crm")
      .upsert(payload as any, { onConflict: "student_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addStudentNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        categoria: z
          .enum(["dieta", "treino", "saude", "sono", "feedback", "ajuste", "geral"])
          .default("geral"),
        texto: z.string().trim().min(1).max(4000),
        data: z.string().max(10).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await crmAssertStudent(context, data.studentId);
    const { error } = await context.supabase.from("student_notes").insert({
      student_id: data.studentId,
      trainer_id: context.userId,
      categoria: data.categoria,
      texto: data.texto,
      ...(data.data ? { data: data.data } : {}),
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudentNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await crmAssertStudent(context, data.studentId);
    const { error } = await context.supabase
      .from("student_notes")
      .delete()
      .eq("id", data.id)
      .eq("student_id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
