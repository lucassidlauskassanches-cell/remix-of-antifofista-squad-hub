import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyDiet } from "@/lib/squad.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
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

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "proteinas", label: "PROTEÍNAS" },
  { key: "carboidratos", label: "CARBOIDRATOS" },
  { key: "frutas", label: "FRUTAS" },
  { key: "gorduras", label: "GORDURAS" },
  { key: "lowfat", label: "LOW FAT" },
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

// Tenta achar o alimento da dieta na tabela de equivalência. Conservador: só
// retorna match quando há boa sobreposição de palavras, pra não sugerir troca
// entre grupos errados.
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
  if (!quantidade) return "";
  const n = parseFloat(quantidade.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? String(n) : "";
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

function SubstPage() {
  const dietFoods = useDietFoods();
  const [group, setGroup] = useState<GroupKey>("proteinas");
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [weight, setWeight] = useState("");

  const items = useMemo(
    () =>
      (data[group] as Item[])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [group],
  );

  function pickDietFood(food: DietFood) {
    const match = matchDietFood(food.alimento);
    if (!match) return;
    setGroup(match.group);
    setFromName(match.item.name);
    setToName("");
    setWeight(parseQty(food.quantidade) || "");
  }

  const matchedFoods = useMemo(
    () => dietFoods.filter((f) => matchDietFood(f.alimento)),
    [dietFoods],
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">CALCULADORA</p>
        <h1 className="tactical-heading text-2xl">SUBSTITUIÇÃO ALIMENTAR</h1>
        <div className="tactical-divider mt-2" />
      </div>

      {matchedFoods.length > 0 && (
        <Card className="p-4 space-y-3">
          <p className="tactical-heading text-xs text-primary tracking-widest">
            DA SUA DIETA
          </p>
          <p className="text-xs text-muted-foreground">
            Toque no alimento que você quer trocar. Já preenchemos a quantidade.
          </p>
          <div className="flex flex-wrap gap-2">
            {matchedFoods.map((f, i) => {
              const active = matchDietFood(f.alimento)?.item.name === fromName;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDietFood(f)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary"
                  }`}
                >
                  {f.alimento}
                  {f.quantidade ? (
                    <span className="text-muted-foreground">
                      {" "}· {f.quantidade}
                      {f.medida ? ` ${f.medida}` : ""}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-5 gap-1 p-1 bg-card rounded-md border border-border">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => {
              setGroup(g.key);
              setFromName("");
              setToName("");
            }}
            className={`tactical-heading text-[10px] py-2 rounded tracking-wider ${
              group === g.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <Calculator
        items={items}
        fromName={fromName}
        toName={toName}
        weight={weight}
        onFrom={setFromName}
        onTo={setToName}
        onWeight={setWeight}
      />
    </div>
  );
}

function Calculator({
  items,
  fromName,
  toName,
  weight,
  onFrom,
  onTo,
  onWeight,
}: {
  items: Item[];
  fromName: string;
  toName: string;
  weight: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onWeight: (v: string) => void;
}) {
  const from = useMemo(() => items.find((i) => i.name === fromName), [items, fromName]);
  const to = useMemo(() => items.find((i) => i.name === toName), [items, toName]);

  const w = parseFloat(weight.replace(",", "."));
  const result =
    from && to && !isNaN(w) && w > 0
      ? Math.round((w / from.qtdBase) * to.qtdAlim * 10) / 10
      : null;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <p className="tactical-heading text-xs text-primary tracking-widest">TENHO / COMO</p>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Alimento atual</label>
          <Select value={fromName} onValueChange={onFrom}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o alimento" />
            </SelectTrigger>
            <SelectContent className="max-h-[50vh]">
              {items.map((i) => (
                <SelectItem key={i.name} value={i.name}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Peso do alimento atual {from ? `(${from.unidBase})` : ""}
          </label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={weight}
            onChange={(e) => onWeight(e.target.value)}
          />
        </div>
      </Card>

      <div className="flex justify-center">
        <ArrowRight className="w-6 h-6 text-primary" />
      </div>

      <Card className="p-4 space-y-3">
        <p className="tactical-heading text-xs text-primary tracking-widest">
          QUERO SUBSTITUIR POR
        </p>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Substituto desejado</label>
          <Select value={toName} onValueChange={onTo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o substituto" />
            </SelectTrigger>
            <SelectContent className="max-h-[50vh]">
              {items.map((i) => (
                <SelectItem key={i.name} value={i.name}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border border-primary/40 bg-primary/5 p-4 text-center">
          <p className="tactical-heading text-xs text-muted-foreground tracking-widest">
            PESO A CONSUMIR
          </p>
          <p className="tactical-heading text-3xl text-primary mt-1">
            {result !== null ? `${result} ${to?.unidAlim ?? ""}` : "—"}
          </p>
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        Todas as trocas são equivalentes dentro do mesmo grupo.
      </p>
    </div>
  );
}
