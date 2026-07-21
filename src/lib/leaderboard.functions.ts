import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PeriodSchema = z.object({ period: z.enum(["weekly", "monthly"]) });

type LeaderboardRow = {
  student_id: string;
  full_name: string;
  trainer_id: string | null;
  trainer_name: string | null;
  points: number;
  current_streak: number;
  rank_position: number;
  total_participants: number;
  points_above: number | null;
  is_self: boolean;
};

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PeriodSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .schema("app_private" as never)
      .rpc("get_leaderboard" as never, {
        _caller: context.userId,
        _period: data.period,
      } as never);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as LeaderboardRow[] };
  });

export const getTrainerLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PeriodSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // authorize: must be admin
    const { data: roles, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Error(roleErr.message);
    if (!(roles ?? []).some((r) => r.role === "admin")) {
      throw new Error("Apenas administradores.");
    }
    const { data: rows, error } = await supabaseAdmin
      .schema("app_private" as never)
      .rpc("get_trainer_leaderboard" as never, {
        _caller: context.userId,
        _period: data.period,
      } as never);
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []) as {
        trainer_id: string;
        trainer_name: string;
        active_students: number;
        avg_points: number;
        avg_streak: number;
      }[],
    };
  });
