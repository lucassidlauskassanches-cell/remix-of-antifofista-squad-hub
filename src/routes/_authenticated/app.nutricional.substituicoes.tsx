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
import { ArrowRight, Info } from "lucide-react";
import {
  SUBSTITUTIONS_AVISO,
  SUBSTITUTION_GROUPS,
  calcSubstitution,
  formatQty,
  matchDietFood,
  roundingHint,
  type SubstitutionGroup,
  type SubstitutionItem,
} from "@/lib/substitutions";
import type { DietPlan } from "@/lib/diet-xlsx-parser";

export const Route = createFileRoute("/_authenticated/app/nutricional/substituicoes")({
  head: () => ({ meta: [
    { title: "Substituições Alimentares — Antifofista Squad" },
    { name: "description", content: "Trocas equivalentes do seu plano nutricional, com pesos de alimentos já prontos." },
    { property: "og:title", content: "Substituições Alimentares — Antifofista Squad" },
    { property: "og:description", content: "Trocas equivalentes do seu plano nutricional, com pesos de alimentos já prontos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SubstPage,
});

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
        const key = alimento.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ alimento, quantidade: it.quantidade, medida: it.medida });
      }),
    );
    return out;
  }, [plan]);
}

function SubstPage() {
  const dietFoods = useDietFoods();
  const [groupId, setGroupId] = useState("proteina");
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [toName2, setToName2] = useState("");
  const [halfMode, setHalfMode] = useState(false);
  const [qty, setQty] = useState("");

  const group = useMemo(
    () => SUBSTITUTION_GROUPS.find((g) => g.id === groupId) ?? SUBSTITUTION_GROUPS[0],
    [groupId],
  );

  const items = useMemo(
    () => group.itens.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [group],
  );

  function reset(group2: SubstitutionGroup) {
    setGroupId(group2.id);
    setFromName("");
    setToName("");
    setToName2("");
    setHalfMode(false);
  }

  function pickDietFood(food: DietFood) {
    const match = matchDietFood(food.alimento);
    if (!match) return;
    if (match.kind === "free") {
      reset(match.group);
      return;
    }
    setGroupId(match.group.id);
    setFromName(match.item.nome);
    setToName("");
    setToName2("");
    setHalfMode(false);
    setQty(parseQty(food.quantidade) || "");
  }

  const matchedFoods = useMemo(
    () => dietFoods.filter((f) => matchDietFood(f.alimento)),
    [dietFoods],
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">CALCULADORA</p>
        <h1 className="tactical-heading text-2xl">TROCAS EQUIVALENTES</h1>
        <div className="tactical-divider mt-2" />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-foreground font-medium">{SUBSTITUTIONS_AVISO}</p>
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
              const m = matchDietFood(f.alimento);
              const active =
                m?.kind === "item" && m.item.nome === fromName && m.group.id === groupId;
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
        {SUBSTITUTION_GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => reset(g)}
            className={`tactical-heading text-[9px] py-2 rounded tracking-wider ${
              groupId === g.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {g.nome.toUpperCase()}
          </button>
        ))}
      </div>

      {group.livre ? (
        <Card className="p-4 space-y-2 text-center">
          <p className="tactical-heading text-xs text-primary tracking-widest">
            {group.nome.toUpperCase()} — LIVRE
          </p>
          <p className="text-sm text-foreground">{group.observacao}</p>
          <p className="text-[11px] text-muted-foreground">
            Este grupo não precisa de conta: a porção é livre dentro da orientação acima.
          </p>
        </Card>
      ) : (
        <Calculator
          group={group}
          items={items}
          fromName={fromName}
          toName={toName}
          toName2={toName2}
          halfMode={halfMode}
          qty={qty}
          onFrom={setFromName}
          onTo={setToName}
          onTo2={setToName2}
          onHalfMode={setHalfMode}
          onQty={setQty}
        />
      )}
    </div>
  );
}

function ResultLine({
  item,
  value,
}: {
  item: SubstitutionItem;
  value: number;
}) {
  const hint = roundingHint(value, item.unidade);
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-4 text-center space-y-1">
      <p className="tactical-heading text-2xl text-primary">
        {formatQty(value)} {item.unidade}
      </p>
      <p className="text-xs text-foreground font-medium">{item.nome}</p>
      {hint && <p className="text-[11px] text-muted-foreground">≈ {hint}</p>}
      {item.obs && (
        <p className="text-[11px] text-primary">Obs.: {item.obs}</p>
      )}
    </div>
  );
}

function Calculator({
  group,
  items,
  fromName,
  toName,
  toName2,
  halfMode,
  qty,
  onFrom,
  onTo,
  onTo2,
  onHalfMode,
  onQty,
}: {
  group: SubstitutionGroup;
  items: SubstitutionItem[];
  fromName: string;
  toName: string;
  toName2: string;
  halfMode: boolean;
  qty: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onTo2: (v: string) => void;
  onHalfMode: (v: boolean) => void;
  onQty: (v: string) => void;
}) {
  const from = useMemo(() => items.find((i) => i.nome === fromName), [items, fromName]);
  const to = useMemo(() => items.find((i) => i.nome === toName), [items, toName]);
  const to2 = useMemo(() => items.find((i) => i.nome === toName2), [items, toName2]);

  const q = parseFloat(qty.replace(",", "."));
  const valid = from && !isNaN(q) && q > 0;

  const result = valid && to ? calcSubstitution(q, from, to) : null;
  const resultHalf1 =
    valid && halfMode && to ? calcSubstitution(q, from, to, 0.5) : null;
  const resultHalf2 =
    valid && halfMode && to2 ? calcSubstitution(q, from, to2, 0.5) : null;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <p className="tactical-heading text-xs text-primary tracking-widest">
          TENHO NA DIETA · {group.nome.toUpperCase()}
        </p>
        {group.referencia && (
          <p className="text-[11px] text-muted-foreground">
            Referência do grupo: {group.referencia}
          </p>
        )}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Alimento atual</label>
          <Select value={fromName} onValueChange={onFrom}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o alimento" />
            </SelectTrigger>
            <SelectContent className="max-h-[50vh]">
              {items.map((i) => (
                <SelectItem key={i.nome} value={i.nome}>
                  {i.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Quantidade na dieta {from ? `(${from.unidade})` : ""}
          </label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={qty}
            onChange={(e) => onQty(e.target.value)}
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
                <SelectItem key={i.nome} value={i.nome}>
                  {i.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={halfMode}
            onChange={(e) => onHalfMode(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          Metade de duas: combinar dois substitutos (50% de cada)
        </label>

        {halfMode && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Segundo substituto</label>
            <Select value={toName2} onValueChange={onTo2}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o segundo substituto" />
              </SelectTrigger>
              <SelectContent className="max-h-[50vh]">
                {items
                  .filter((i) => i.nome !== toName)
                  .map((i) => (
                    <SelectItem key={i.nome} value={i.nome}>
                      {i.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!halfMode && (
          <div className="space-y-2">
            <p className="tactical-heading text-xs text-muted-foreground tracking-widest text-center">
              PESO A CONSUMIR
            </p>
            {result !== null && to ? (
              <ResultLine item={to} value={result} />
            ) : (
              <div className="rounded-md border border-border p-4 text-center">
                <p className="tactical-heading text-3xl text-muted-foreground">—</p>
              </div>
            )}
          </div>
        )}

        {halfMode && (
          <div className="space-y-2">
            <p className="tactical-heading text-xs text-muted-foreground tracking-widest text-center">
              METADE DE CADA
            </p>
            <div className="grid grid-cols-2 gap-2">
              {resultHalf1 !== null && to ? (
                <ResultLine item={to} value={resultHalf1} />
              ) : (
                <div className="rounded-md border border-border p-4 text-center">
                  <p className="tactical-heading text-xl text-muted-foreground">—</p>
                </div>
              )}
              {resultHalf2 !== null && to2 ? (
                <ResultLine item={to2} value={resultHalf2} />
              ) : (
                <div className="rounded-md border border-border p-4 text-center">
                  <p className="tactical-heading text-xl text-muted-foreground">—</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        Trocas somente dentro do mesmo grupo. Todos os itens de um grupo são
        equivalentes entre si.
      </p>
    </div>
  );
}
