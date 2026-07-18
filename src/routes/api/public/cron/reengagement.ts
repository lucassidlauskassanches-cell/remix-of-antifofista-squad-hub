import { createFileRoute } from "@tanstack/react-router";

const MIN_DAYS = 3;
const COOLDOWN_DAYS = 3;

export const Route = createFileRoute("/api/public/cron/reengagement")({
  server: {
    handlers: {
      GET: async () => runResponse(),
      POST: async () => runResponse(),
    },
  },
});

function diffDays(fromISO: string, toISO: string) {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

async function runResponse() {
  const { getActiveSubscribedStudents, sendOncePerDay, todayInSaoPaulo } = await import(
    "@/lib/push-notify.server"
  );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = todayInSaoPaulo();
  const students = await getActiveSubscribedStudents();
  const ids = students.map((s) => s.id);
  const results = { total: students.length, sent: 0, skipped: 0, notEligible: 0 };
  if (ids.length === 0) return json(results);

  const { data: logs } = await supabaseAdmin
    .from("daily_logs")
    .select("student_id, log_date")
    .in("student_id", ids)
    .order("log_date", { ascending: false });
  const lastByUser = new Map<string, string>();
  (logs ?? []).forEach((l) => {
    if (!lastByUser.has(l.student_id)) lastByUser.set(l.student_id, l.log_date);
  });

  const cooldownStart = todayInSaoPaulo(-COOLDOWN_DAYS);
  const { data: recentLog } = await supabaseAdmin
    .from("notification_log")
    .select("user_id, sent_date")
    .eq("type", "reengagement")
    .gte("sent_date", cooldownStart)
    .in("user_id", ids);
  const recentSet = new Set((recentLog ?? []).map((r) => r.user_id));

  await Promise.all(
    students.map(async (s) => {
      try {
        if (recentSet.has(s.id)) {
          results.notEligible++;
          return;
        }
        const last = lastByUser.get(s.id);
        if (!last) {
          results.notEligible++;
          return;
        }
        const n = diffDays(last, today);
        if (n < MIN_DAYS) {
          results.notEligible++;
          return;
        }
        const r = await sendOncePerDay(
          s.id,
          "reengagement",
          {
            title: "ANTIFOFISTA SQUAD",
            body: `Sumiu? Tá tudo bem? Não vemos você há ${n} dias 🥹`,
            url: "/app/registro",
          },
          today,
        );
        if (r.skipped) results.skipped++;
        else if (r.sent > 0) results.sent++;
      } catch (err) {
        console.error("[cron reengagement] user failed", s.id, err);
      }
    }),
  );
  return json(results);
}

function json(v: unknown) {
  return new Response(JSON.stringify(v), { headers: { "content-type": "application/json" } });
}
