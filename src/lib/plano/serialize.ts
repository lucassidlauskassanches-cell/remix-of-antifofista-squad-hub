import type { StructuredPlan, StructuredExercise } from "@/lib/training-xlsx-parser";
import type { DietPlan } from "@/lib/diet-xlsx-parser";

// Reaproveita o treino/dieta já parseados do XLSX (guardados no Supabase) e os
// transforma em texto legível pra IA do Plano de Ação, no lugar dos PDFs que o
// gerador standalone usava. Vira o `treinoTexto`/`dietaTexto` do generateCopy.

function exerciseLine(ex: StructuredExercise, weeks: string[]): string {
  const weekParts = (ex.weeks ?? [])
    .map((v, i) => {
      const val = (v ?? "").trim();
      if (!val) return null;
      const label = weeks[i] ?? `Semana ${i + 1}`;
      return `${label}: ${val}`;
    })
    .filter(Boolean);
  const presc = weekParts.length ? ` (${weekParts.join(" | ")})` : "";
  const note = ex.note?.trim() ? ` — obs: ${ex.note.trim()}` : "";
  return `  - ${ex.name}${presc}${note}`;
}

export function serializeTraining(plan: StructuredPlan): string {
  if (!plan) return "";
  const weeks = plan.weeks ?? [];
  const out: string[] = [];
  if (weeks.length) out.push(`Periodização: ${weeks.length} semanas (${weeks.join(", ")}).`);

  for (const block of plan.blocks ?? []) {
    const day = block.day ? ` - ${block.day}` : "";
    out.push("");
    out.push(`${block.name}${day}:`);
    for (const ex of block.exercises ?? []) out.push(exerciseLine(ex, weeks));
  }

  if (plan.abdomen?.length) {
    out.push("");
    out.push("Abdômen:");
    for (const ex of plan.abdomen) out.push(exerciseLine(ex, weeks));
  }
  if (plan.cardio?.length) {
    out.push("");
    out.push("Cardio:");
    for (const ex of plan.cardio) out.push(exerciseLine(ex, weeks));
  }
  if (plan.tips?.length) {
    out.push("");
    out.push("Dicas e considerações:");
    for (const t of plan.tips) out.push(`  - ${t}`);
  }
  return out.join("\n").trim();
}

export function serializeDiet(plan: DietPlan): string {
  if (!plan) return "";
  const out: string[] = [];

  if (plan.suplementos?.length) {
    out.push("Suplementação e manipulados:");
    for (const s of plan.suplementos) {
      const dose = s.dose?.trim() ? ` · ${s.dose.trim()}` : "";
      const hora = s.horario?.trim() ? ` · ${s.horario.trim()}` : "";
      out.push(`  - ${s.nome}${dose}${hora}`);
    }
  }

  for (const meal of plan.refeicoes ?? []) {
    out.push("");
    out.push(`${meal.nome}:`);
    for (const it of meal.itens ?? []) {
      const qtd = it.quantidade?.trim() ? ` · ${it.quantidade.trim()}` : "";
      const med = it.medida?.trim() ? ` ${it.medida.trim()}` : "";
      out.push(`  - ${it.alimento}${qtd}${med}`);
    }
  }

  if (plan.observacoes?.trim()) {
    out.push("");
    out.push(`Observações: ${plan.observacoes.trim()}`);
  }
  return out.join("\n").trim();
}
