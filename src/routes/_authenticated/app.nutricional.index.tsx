import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMyDiet } from "@/lib/squad.functions";
import { Card } from "@/components/ui/card";
import { Table2, LayoutList } from "lucide-react";
import type { DietPlan } from "@/lib/diet-xlsx-parser";

export const Route = createFileRoute("/_authenticated/app/nutricional/")({
  component: DietaPage,
});

function DietaPage() {
  const fetchDiet = useServerFn(getMyDiet);
  const [planilha, setPlanilha] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["my-diet"],
    queryFn: () => fetchDiet(),
  });

  if (isLoading) {
    return (
      <p className="text-center py-16 text-muted-foreground">Carregando...</p>
    );
  }

  const plan = cleanDietPlan((data?.data as DietPlan | undefined) ?? null);
  if (!plan || (plan.suplementos.length === 0 && plan.refeicoes.length === 0)) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Nenhuma dieta disponível ainda. Aguarde seu treinador enviar a planilha.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {plan.suplementos.length > 0 && (
        <Card className="p-4 space-y-3">
          <div>
            <p className="tactical-heading text-xs text-primary tracking-widest">
              SUPLEMENTAÇÃO E MANIPULADOS
            </p>
            <div className="tactical-divider mt-2" />
          </div>
          <ul className="divide-y divide-border">
            {plan.suplementos.map((s, i) => (
              <li key={i} className="py-2">
                <p className="text-sm font-semibold">{s.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {s.dose ? <span>Dose: {s.dose}</span> : null}
                  {s.dose && s.horario ? <span className="mx-1">·</span> : null}
                  {s.horario ? <span>{s.horario}</span> : null}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {plan.refeicoes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="tactical-heading text-xs text-primary tracking-widest">
              SUGESTÃO ALIMENTAR
            </p>
            <button
              type="button"
              onClick={() => setPlanilha((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {planilha ? (
                <>
                  <LayoutList className="w-3.5 h-3.5" /> Ver em cards
                </>
              ) : (
                <>
                  <Table2 className="w-3.5 h-3.5" /> Ver em planilha
                </>
              )}
            </button>
          </div>

          {planilha ? (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {plan.refeicoes.map((m, i) => (
                    <FragmentMeal key={i} nome={m.nome} itens={m.itens} />
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            plan.refeicoes.map((m, i) => (
              <Card key={i} className="p-4 space-y-2">
                <p className="tactical-heading text-sm tracking-widest">
                  {m.nome.toUpperCase()}
                </p>
                <div className="tactical-divider" />
                <ul className="divide-y divide-border">
                  {m.itens.map((it, j) => (
                    <li
                      key={j}
                      className="py-2 grid grid-cols-[1fr_auto] gap-2 items-baseline"
                    >
                      <span className="text-sm">{it.alimento}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {it.quantidade}
                        {it.quantidade && it.medida ? " " : ""}
                        {it.medida}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
        </div>
      )}

      {plan.observacoes && (
        <Card className="p-4">
          <p className="tactical-heading text-xs text-primary tracking-widest mb-2">
            OBSERVAÇÕES
          </p>
          <p className="text-sm whitespace-pre-wrap">{plan.observacoes}</p>
        </Card>
      )}
    </div>
  );
}

function FragmentMeal({
  nome,
  itens,
}: {
  nome: string;
  itens: { alimento: string; quantidade?: string; medida?: string }[];
}) {
  return (
    <>
      <tr className="bg-secondary/40 border-b border-border">
        <td
          colSpan={2}
          className="px-3 py-1.5 tactical-heading text-[10px] tracking-widest text-primary"
        >
          {nome.toUpperCase()}
        </td>
      </tr>
      {itens.map((it, j) => (
        <tr key={j} className="border-b border-border/60">
          <td className="px-3 py-1.5">{it.alimento}</td>
          <td className="px-3 py-1.5 text-right text-xs text-muted-foreground whitespace-nowrap">
            {it.quantidade}
            {it.quantidade && it.medida ? " " : ""}
            {it.medida}
          </td>
        </tr>
      ))}
    </>
  );
}

function isVisibleMealItem(item: { alimento?: string; quantidade?: string; medida?: string }) {
  const alimento = item.alimento?.trim() ?? "";
  if (!alimento) return false;
  const normalized = alimento
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!/[a-z]/.test(normalized)) return false;
  if (["observacoes", "observacao", "obs", "alimento", "qtd", "quantidade", "medida"].includes(normalized)) {
    return false;
  }
  return true;
}

function cleanDietPlan(plan: DietPlan | null): DietPlan | null {
  if (!plan) return null;
  return {
    suplementos: (plan.suplementos ?? []).filter((s) => s.nome?.trim()),
    refeicoes: (plan.refeicoes ?? [])
      .map((meal) => ({
        ...meal,
        nome: meal.nome?.trim() || "Refeição",
        itens: (meal.itens ?? []).filter(isVisibleMealItem),
      }))
      .filter((meal) => meal.itens.length > 0),
    observacoes: plan.observacoes ?? "",
  };
}
