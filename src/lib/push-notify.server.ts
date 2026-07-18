// Server-only push notification helper.
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) {
    throw new Error("Missing VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT env vars");
  }
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type PushType = "morning_water" | "water_gap" | "reengagement";

// Brasília is UTC-3 all year (no DST). Convert current UTC → São Paulo local date.
export function todayInSaoPaulo(offsetDays = 0): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureConfigured();
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!subs || subs.length === 0) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          console.error("[push] send failed", { userId, endpoint: s.endpoint, err });
        }
      }
    }),
  );
  return { sent, removed };
}

/** Skip if already logged today for this (user,type); otherwise send + log. */
export async function sendOncePerDay(
  userId: string,
  type: PushType,
  payload: PushPayload,
  saoPauloDate: string,
) {
  const { data: existing, error: chkErr } = await supabaseAdmin
    .from("notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("sent_date", saoPauloDate)
    .maybeSingle();
  if (chkErr) throw new Error(chkErr.message);
  if (existing) return { skipped: true, sent: 0, removed: 0 };

  const result = await sendPushToUser(userId, payload);
  if (result.sent > 0) {
    await supabaseAdmin.from("notification_log").insert({
      user_id: userId,
      type,
      sent_date: saoPauloDate,
    });
  }
  return { skipped: false, ...result };
}

/** Latest known weight for a student, falling back to initial. */
export async function getLatestWeightKg(studentId: string, fallback: number | null) {
  const { data } = await supabaseAdmin
    .from("weight_entries")
    .select("weight_kg, entry_date")
    .eq("student_id", studentId)
    .order("entry_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.weight_kg ?? fallback) ?? null;
}

/** Active students that have at least one push subscription. */
export async function getActiveSubscribedStudents() {
  const { data: subs, error: subsErr } = await supabaseAdmin
    .from("push_subscriptions")
    .select("user_id");
  if (subsErr) throw new Error(subsErr.message);
  const userIds = Array.from(new Set((subs ?? []).map((r) => r.user_id)));
  if (userIds.length === 0) return [];

  const { data: profiles, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, water_ml_per_kg, initial_weight_kg, active")
    .in("id", userIds)
    .eq("active", true);
  if (profErr) throw new Error(profErr.message);
  return profiles ?? [];
}
