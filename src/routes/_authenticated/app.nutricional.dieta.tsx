import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyDiet } from "@/lib/squad.functions";
import { Card } from "@/components/ui/card";
import type { DietPlan } from "@/lib/diet-xlsx-parser";

export const Route = createFileRoute("/_authenticated/app/nutricional/dieta")({
  component: DietaPage,
});

function DietaPage() {
  const fetchDiet = useServerFn(getMyDiet);
  const { data, isLoading } = useQuery({
    queryKey: ["my-diet"],
    queryFn: () => fetchDiet(),
  });

  if (isLoading) {
    return (
      <p className="text-center py-16 text-muted-foreground">Carregando...</p>
    );
  }

  const plan = (data?.data as DietPlan | undefined) ?? null;
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
          <p className="tactical-heading text-xs text-primary tracking-widest">
            PRESCRIÇÃO ALIMENTAR
          </p>
          {plan.refeicoes.map((m, i) => (
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
          ))}
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
