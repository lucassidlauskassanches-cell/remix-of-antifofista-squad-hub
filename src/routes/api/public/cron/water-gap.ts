import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getActiveSubscribedStudents,
  getLatestWeightKg,
  sendOncePerDay,
  todayInSaoPaulo,
} from "@/lib/push-notify.server";

const GAP_MAX_ML = 750;

async function run() {
  const today = todayInSaoPaulo();
  const students = await getActiveSubscribedStudents();
  const ids = students.map((s) => s.id);
  const results = { total: students.length, sent: 0, skipped: 0, notEligible: 0 };
  if (ids.length === 0) return results;

  const { data: logs } = await supabaseAdmin
    .from("daily_logs")
    .select("student_id, water_ml")
    .eq("log_date", today)
    .in("student_id", ids);
  const logsByUser = new Map<string, number>();
  (logs ?? []).forEach((l) => logsByUser.set(l.student_id, l.water_ml ?? 0));

  await Promise.all(
    students.map(async (s) => {
      try {
        const drunk = logsByUser.get(s.id);
        if (!drunk || drunk <= 0) {
          results.notEligible++;
          return;
        }
        const weight = await getLatestWeightKg(s.id, s.initial_weight_kg);
        if (!weight || !s.water_ml_per_kg) {
          results.notEligible++;
          return;
        }
        const goalMl = Math.round(weight * s.water_ml_per_kg);
        const remaining = goalMl - drunk;
        if (remaining <= 0 || remaining > GAP_MAX_ML) {
          results.notEligible++;
          return;
        }
        const remainingStr =
          remaining >= 1000
            ? `${(Math.round(remaining / 100) / 10).toString().replace(".", ",")} L`
            : `${remaining}ml`;
        const body =
          remaining >= 1000
            ? `Falta ${remainingStr} pra bater sua meta de água.`
            : `Faltam ${remainingStr} pra bater sua meta de água.`;
        const r = await sendOncePerDay(
          s.id,
          "water_gap",
          { title: "ANTIFOFISTA SQUAD", body, url: "/app/registro" },
          today,
        );
        if (r.skipped) results.skipped++;
        else if (r.sent > 0) results.sent++;
      } catch (err) {
        console.error("[cron water-gap] user failed", s.id, err);
      }
    }),
  );
  return results;
}

export const Route = createFileRoute("/api/public/cron/water-gap")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await run()), { headers: { "content-type": "application/json" } }),
      POST: async () => new Response(JSON.stringify(await run()), { headers: { "content-type": "application/json" } }),
    },
  },
});
