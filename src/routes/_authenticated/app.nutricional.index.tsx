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
    <div>
      {plan.refeicoes.length > 0 && (
        <button
          type="button"
          className="af-planilha"
          onClick={() => setPlanilha((v) => !v)}
        >
          {planilha ? (
            <LayoutList className="w-3.5 h-3.5" />
          ) : (
            <Table2 className="w-3.5 h-3.5" />
          )}
          {planilha ? "Ver dieta em cards" : "Ver dieta em planilha"}
        </button>
      )}

      <div className="mt-3" />

      {plan.suplementos.length > 0 && (
        <>
          <div className="af-sec">
            <span>Suplementação e manipulados</span>
            <div className="ln" />
          </div>
          <div className="af-meal">
            <ul>
              {plan.suplementos.map((s, i) => (
                <li key={i}>
                  <span>{s.nome}</span>
                  <span className="q">
                    {s.dose ? s.dose : ""}
                    {s.dose && s.horario ? " · " : ""}
                    {s.horario ? s.horario : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {plan.refeicoes.length > 0 &&
        (planilha ? (
          <Card className="overflow-hidden mt-4">
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
            <div key={i}>
              <div className="af-sec">
                <span>{m.nome}</span>
                <div className="ln" />
              </div>
              <div className="af-meal">
                <ul>
                  {m.itens.map((it, j) => (
                    <li key={j}>
                      <span>{it.alimento}</span>
                      <span className="q">
                        {it.quantidade}
                        {it.quantidade && it.medida ? " " : ""}
                        {it.medida}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))
        ))}

      {plan.observacoes && (
        <>
          <div className="af-sec">
            <span>Observações</span>
            <div className="ln" />
          </div>
          <div className="af-meal">
            <p className="text-sm whitespace-pre-wrap">{plan.observacoes}</p>
          </div>
        </>
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
    .replace(/[̀-ͯ]/g, "")
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
