import { CRM_LIMITES } from "@/lib/crm-config";

export type AlertKey =
  | "sumido"
  | "checkin_vencido"
  | "checkin_proximo"
  | "feedback_antigo"
  | "adesao_queda"
  | "plano_a_montar";

export type StudentAlert = {
  key: AlertKey;
  label: string;
  /** Quanto maior, mais urgente. */
  peso: number;
  tone: "danger" | "warn" | "info";
};

export type PanelRowInput = {
  lastActivity: string | null;
  lastFeedback: string | null;
  adesao7: number | null;
  proximoCheckin: string | null;
  hasPlan: boolean;
};

function diffDias(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function computeAlerts(row: PanelRowInput, today: string): StudentAlert[] {
  const out: StudentAlert[] = [];
  const L = CRM_LIMITES;

  const semAtividade = row.lastActivity ? diffDias(row.lastActivity, today) : null;
  if (semAtividade === null || semAtividade >= L.sumidoDias) {
    out.push({
      key: "sumido",
      label:
        semAtividade === null
          ? "Sem nenhum registro — cobrar"
          : `Sem atividade há ${semAtividade} dias — cobrar`,
      peso: 100 + (semAtividade ?? 60),
      tone: "danger",
    });
  }

  if (row.proximoCheckin) {
    const atraso = diffDias(row.proximoCheckin, today);
    if (atraso >= L.checkinAtrasoDias) {
      out.push({
        key: "checkin_vencido",
        label:
          atraso === 0 ? "Check-in é hoje" : `Check-in atrasado ${atraso} dias`,
        peso: 90 + atraso,
        tone: "danger",
      });
    } else if (-atraso <= L.checkinProximoDias) {
      out.push({
        key: "checkin_proximo",
        label: `Check-in em ${-atraso} dias`,
        peso: 40,
        tone: "info",
      });
    }
  }

  const semFeedback = row.lastFeedback ? diffDias(row.lastFeedback, today) : null;
  if (semFeedback !== null && semFeedback >= L.feedbackAntigoDias) {
    out.push({
      key: "feedback_antigo",
      label: `Último feedback há ${semFeedback} dias`,
      peso: 60 + semFeedback / 10,
      tone: "warn",
    });
  }

  if (row.adesao7 !== null && row.adesao7 < L.adesaoBaixaPct) {
    out.push({
      key: "adesao_queda",
      label: `Adesão ${Math.round(row.adesao7)}% na semana`,
      peso: 70,
      tone: "warn",
    });
  }

  if (!row.hasPlan) {
    out.push({
      key: "plano_a_montar",
      label: "Sem plano ativo — montar",
      peso: 85,
      tone: "warn",
    });
  }

  return out.sort((a, b) => b.peso - a.peso);
}

export function urgencia(alerts: StudentAlert[]): number {
  return alerts.reduce((sum, a) => sum + a.peso, 0);
}
