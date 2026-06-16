import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyNutrition } from "@/lib/squad.functions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/nutricional")({
  component: NutriPage,
});

function NutriPage() {
  const fetchNutri = useServerFn(getMyNutrition);
  const { data } = useSuspenseQuery({
    queryKey: ["my-nutrition"],
    queryFn: () => fetchNutri(),
  });

  if (!data.plan) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Nenhum plano nutricional ativo ainda.
      </div>
    );
  }

  // Daily totals
  const dayTotals = data.items.reduce(
    (acc, it) => ({
      calories: acc.calories + (Number(it.calories) || 0),
      protein: acc.protein + (Number(it.protein) || 0),
      carbs: acc.carbs + (Number(it.carbs) || 0),
      fat: acc.fat + (Number(it.fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          PLANO ATIVO
        </p>
        <h1 className="tactical-heading text-2xl">{data.plan.title || "Dieta"}</h1>
        <div className="tactical-divider mt-2" />
      </div>

      {data.plan.general_notes && (
        <Card className="p-4 bg-secondary/20 border-secondary">
          <p className="tactical-heading text-xs text-primary mb-2">
            ORIENTAÇÕES GERAIS
          </p>
          <p className="text-sm whitespace-pre-wrap">{data.plan.general_notes}</p>
        </Card>
      )}

      {dayTotals.calories > 0 && (
        <Card className="p-3 bg-card border-border">
          <p className="tactical-heading text-xs text-primary mb-2">TOTAL DO DIA</p>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <Stat label="kcal" value={dayTotals.calories} />
            <Stat label="P" value={dayTotals.protein} />
            <Stat label="C" value={dayTotals.carbs} />
            <Stat label="G" value={dayTotals.fat} />
          </div>
        </Card>
      )}

      <Accordion
        type="multiple"
        defaultValue={data.meals.map((m) => m.id)}
      >
        {data.meals.map((meal) => {
          const items = data.items.filter((i) => i.meal_id === meal.id);
          const mealTotals = items.reduce(
            (a, it) => ({
              c: a.c + (Number(it.calories) || 0),
              p: a.p + (Number(it.protein) || 0),
            }),
            { c: 0, p: 0 },
          );
          return (
            <AccordionItem key={meal.id} value={meal.id} className="border-border">
              <AccordionTrigger className="tactical-heading text-left">
                <div className="flex-1 flex items-center justify-between pr-2">
                  <span>
                    {meal.meal_name}
                    {meal.meal_time ? ` — ${meal.meal_time}` : ""}
                  </span>
                  {mealTotals.c > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">
                      {Math.round(mealTotals.c)} kcal
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {items.map((it) => (
                    <li
                      key={it.id}
                      className="p-3 rounded-md bg-card border border-border"
                    >
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="font-medium">{it.food_name}</p>
                          {it.quantity && (
                            <p className="text-xs text-muted-foreground">
                              {it.quantity}
                            </p>
                          )}
                          {it.notes && (
                            <p className="text-xs text-foreground/70 mt-1">
                              {it.notes}
                            </p>
                          )}
                        </div>
                        {it.calories != null && (
                          <span className="text-xs text-primary tactical-heading whitespace-nowrap">
                            {Math.round(Number(it.calories))} kcal
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="tactical-heading text-primary text-lg">{Math.round(value)}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
