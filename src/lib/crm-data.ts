// Helpers puros do Manual de Bordo (sem createServerFn, sem imports server-only).
import { computeAlerts, urgencia, type StudentAlert } from "@/lib/crm-alerts";

type Ctx = { supabase: any; userId: string };

export async function crmRoles(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", ["treinador", "admin"]);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.length) throw new Error("Forbidden: treinador required");
  return { isAdmin: roles.includes("admin"), isTrainer: roles.includes("treinador") };
}

export async function crmAssertStudent(ctx: Ctx, studentId: string) {
  const { isAdmin } = await crmRoles(ctx);
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

/** Busca todas as linhas paginando (PostgREST limita a 1000 por chamada). */
export async function fetchAll(makeQuery: (from: number, to: number) => any) {
  const out: any[] = [];
  const size = 1000;
  for (let page = 0; page < 20; page++) {
    const from = page * size;
    const { data, error } = await makeQuery(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export type PanelRow = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  objetivo: string | null;
  plano_tipo: string | null;
  data_vencimento: string | null;
  whatsapp_grupo_url: string | null;
  lastActivity: string | null;
  lastFeedback: string | null;
  adesao7: number | null;
  streak: number;
  lastCheckin: { data_recebida: string; status: string } | null;
  nextReminder: { texto: string; data_alvo: string } | null;
  hasPlan: boolean;
  alerts: StudentAlert[];
  urgencia: number;
};

export function buildPanelRow(
  base: { id: string; full_name: string; email: string },
  info: {
    crm: any | null;
    lastActivity: string | null;
    lastFeedback: string | null;
    adesao7: number | null;
    streak: number;
    lastCheckin: { data_recebida: string; status: string } | null;
    nextReminder: { texto: string; data_alvo: string } | null;
    hasPlan: boolean;
  },
  today: string,
): PanelRow {
  const reminderVencido =
    info.nextReminder && info.nextReminder.data_alvo <= today
      ? info.nextReminder.texto
      : null;
  const alerts = computeAlerts(
    {
      lastActivity: info.lastActivity,
      lastFeedback: info.lastFeedback,
      adesao7: info.adesao7,
      lastCheckinDate: info.lastCheckin?.data_recebida ?? null,
      dataVencimento: info.crm?.data_vencimento ?? null,
      hasPlan: info.hasPlan,
      reminderVencido,
    },
    today,
  );
  return {
    id: base.id,
    full_name: base.full_name,
    email: base.email,
    status: info.crm?.status ?? "ativo",
    objetivo: info.crm?.objetivo ?? null,
    plano_tipo: info.crm?.plano_tipo ?? null,
    data_vencimento: info.crm?.data_vencimento ?? null,
    whatsapp_grupo_url: info.crm?.whatsapp_grupo_url ?? null,
    lastActivity: info.lastActivity,
    lastFeedback: info.lastFeedback,
    adesao7: info.adesao7,
    streak: info.streak,
    lastCheckin: info.lastCheckin,
    nextReminder: info.nextReminder,
    hasPlan: info.hasPlan,
    alerts,
    urgencia: urgencia(alerts),
  };
}
