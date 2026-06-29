import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyDiet } from "@/lib/squad.functions";
import data from "@/lib/substitutions-data.json";
import type { DietPlan } from "@/lib/diet-xlsx-parser";

export const Route = createFileRoute("/_authenticated/app/nutricional/substituicoes")({
  component: SubstPage,
});

type GroupKey = keyof typeof data;

type Item = {
  name: string;
  qtdBase: number;
  unidBase: string;
  qtdAlim: number;
  unidAlim: string;
};

const GROUPS: { key: GroupKey }[] = [
  { key: "proteinas" },
  { key: "carboidratos" },
  { key: "frutas" },
  { key: "gorduras" },
  { key: "lowfat" },
];

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const QUALIFIERS = new Set([
  "cru", "crua", "crus", "cruas", "cozido", "cozida", "cozidos", "cozidas",
  "grelhado", "grelhada", "assado", "assada", "frito", "frita", "fresco",
  "fresca", "em", "de", "da", "do", "com", "sem", "s", "light", "integral",
  "lata", "enlatado", "enlatada", "branco", "branca", "g", "ml", "und", "kg",
  "porcao", "porcoes", "colher", "colheres", "fatia", "fatias", "unidade", "unidades",
]);

function tokens(s: string) {
  return normalize(s).split(" ").filter((t) => t && !QUALIFIERS.has(t));
}

const ALL_ITEMS: { item: Item; group: GroupKey }[] = GROUPS.flatMap((g) =>
  (data[g.key] as Item[]).map((item) => ({ item, group: g.key })),
);

// Acha o alimento da dieta na tabela de equivalência. Conservador: só casa
// quando há boa sobreposição de palavras, pra não trocar entre grupos errados.
function matchDietFood(food: string): { item: Item; group: GroupKey } | null {
  const ft = tokens(food);
  if (!ft.length) return null;
  let best: { item: Item; group: GroupKey } | null = null;
  let bestScore = 0;
  for (const entry of ALL_ITEMS) {
    const it = tokens(entry.item.name);
    if (!it.length) continue;
    const overlap = ft.filter((t) => it.includes(t)).length;
    if (overlap === 0) continue;
    const score = overlap / Math.max(it.length, ft.length);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

function parseQty(quantidade?: string) {
  const n = parseFloat((quantidade || "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

type DietFood = { alimento: string; quantidade?: string; medida?: string };

function useDietFoods(): DietFood[] {
  const fetchDiet = useServerFn(getMyDiet);
  const { data: res } = useQuery({
    queryKey: ["my-diet"],
    queryFn: () => fetchDiet(),
  });
  const plan = (res?.data as DietPlan | undefined) ?? null;
  return useMemo(() => {
    const seen = new Set<string>();
    const out: DietFood[] = [];
    (plan?.refeicoes ?? []).forEach((m) =>
      (m.itens ?? []).forEach((it) => {
        const alimento = it.alimento?.trim();
        if (!alimento) return;
        const key = normalize(alimento);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push({ alimento, quantidade: it.quantidade, medida: it.medida });
      }),
    );
    return out;
  }, [plan]);
}

type SubCard = {
  food: DietFood;
  alts: string[];
};

function SubstPage() {
  const dietFoods = useDietFoods();

  const cards = useMemo<SubCard[]>(() => {
    return dietFoods
      .map((food) => {
        const match = matchDietFood(food.alimento);
        if (!match) return null;
        const { item: from, group } = match;
        const weight = parseQty(food.quantidade);
        const alts = (data[group] as Item[])
          .filter((to) => to.name !== from.name)
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map((to) => {
            if (weight === null) return to.name;
            const qtd = Math.round((weight / from.qtdBase) * to.qtdAlim * 10) / 10;
            return `${to.name} ${qtd}${to.unidAlim}`;
          });
        if (!alts.length) return null;
        return { food, alts } satisfies SubCard;
      })
      .filter((c): c is SubCard => c !== null);
  }, [dietFoods]);

  return (
    <div>
      <div className="af-eyebrow">Baseado na sua dieta</div>
      <div className="af-title">Substituições</div>
      <p className="af-lead">
        Cada alimento da sua dieta com trocas equivalentes do mesmo grupo, já no
        peso que você consome.
      </p>

      {cards.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Quando seu treinador enviar a dieta, as trocas equivalentes de cada
          alimento aparecem aqui.
        </div>
      ) : (
        <div>
          {cards.map((c, i) => (
            <div key={i} className="af-sub-item">
              <div className="from">
                <span>{c.food.alimento}</span>
                {(c.food.quantidade || c.food.medida) && (
                  <span className="q">
                    {c.food.quantidade}
                    {c.food.quantidade && c.food.medida ? " " : ""}
                    {c.food.medida}
                  </span>
                )}
              </div>
              <div className="arrow">pode trocar por</div>
              <div className="alts">
                {c.alts.map((a, j) => (
                  <span key={j} className="af-alt">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
