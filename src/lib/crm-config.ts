// Limites dos alertas automáticos do Manual de Bordo.
// Ajuste tudo por aqui — um só lugar.
export const CRM_LIMITES = {
  /** Dias sem nenhum registro (água/treino/peso) para o aluno ser "sumido". */
  sumidoDias: 7,
  /** Dias sem check-in/nota para "último feedback antigo". */
  feedbackAntigoDias: 45,
  /** Adesão média (%) dos últimos 7 dias abaixo disso => "adesão em queda". */
  adesaoBaixaPct: 50,
  /** Dias de antecedência para avisar renovação próxima. */
  renovacaoDias: 10,
  /** Tolerância (dias) após a data esperada do check-in. */
  checkinAtrasoDias: 1,
  /** Intervalo padrão entre check-ins (dias). */
  checkinIntervaloDias: 7,
} as const;

export const STATUS_LABEL = {
  ativo: "Ativo",
  aguardando_checkin: "Aguardando check-in",
  aguardando_resposta: "Aguardando resposta",
  plano_a_montar: "Plano a montar",
  renovacao_proxima: "Renovação próxima",
} as const;

export type CrmStatus = keyof typeof STATUS_LABEL;

export const CATEGORIA_LABEL = {
  dieta: "Dieta",
  treino: "Treino",
  saude: "Saúde",
  sono: "Sono",
  feedback: "Feedback",
  ajuste: "Ajuste",
  geral: "Geral",
} as const;

export type NoteCategoria = keyof typeof CATEGORIA_LABEL;

export const CATEGORIA_COR: Record<NoteCategoria, string> = {
  dieta: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  treino: "bg-primary/15 text-primary border-primary/30",
  saude: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  sono: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  feedback: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  ajuste: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  geral: "bg-muted text-muted-foreground border-border",
};

export const PLANO_TIPO_LABEL = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
} as const;
