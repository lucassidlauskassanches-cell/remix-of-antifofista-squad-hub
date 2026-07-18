import { createFileRoute } from "@tanstack/react-router";
import {
  getActiveSubscribedStudents,
  getLatestWeightKg,
  sendOncePerDay,
  todayInSaoPaulo,
} from "@/lib/push-notify.server";

async function run() {
  const today = todayInSaoPaulo();
  const students = await getActiveSubscribedStudents();
  const results = { total: students.length, sent: 0, skipped: 0, noGoal: 0 };
  await Promise.all(
    students.map(async (s) => {
      try {
        const weight = await getLatestWeightKg(s.id, s.initial_weight_kg);
        if (!weight || !s.water_ml_per_kg) {
          results.noGoal++;
          return;
        }
        const litres = Math.round((weight * s.water_ml_per_kg) / 100) / 10;
        const r = await sendOncePerDay(
          s.id,
          "morning_water",
          {
            title: "ANTIFOFISTA SQUAD",
            body: `Bom dia, Antifofista. Meta de água de hoje: ${litres.toString().replace(".", ",")} L. Bora.`,
            url: "/app/registro",
          },
          today,
        );
        if (r.skipped) results.skipped++;
        else if (r.sent > 0) results.sent++;
      } catch (err) {
        console.error("[cron morning-water] user failed", s.id, err);
      }
    }),
  );
  return results;
}

export const Route = createFileRoute("/api/public/cron/morning-water")({
  server: {
    handlers: {
      GET: async () => {
        const r = await run();
        return new Response(JSON.stringify(r), {
          headers: { "content-type": "application/json" },
        });
      },
      POST: async () => {
        const r = await run();
        return new Response(JSON.stringify(r), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
