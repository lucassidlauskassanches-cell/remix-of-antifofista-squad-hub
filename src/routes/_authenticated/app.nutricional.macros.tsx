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
  GROUP_LABEL,
  MACRO_FOODS,
  calcMacroSubstitution,
  eligibleSubstitutes,
  findFood,
  formatNum,
  matchMacroFood,
} from "@/lib/macro-substitutions";
import type { DietPlan } from "@/lib/diet-xlsx-parser";

export const Route = createFileRoute("/_authenticated/app/nutricional/macros")({
  head: () => ({ meta: [
    { title: "Substituição por Macros — Antifofista Squad" },
    { name: "description", content: "Troque alimentos do mesmo grupo igualando proteína, carboidrato ou gordura." },
    { property: "og:title", content: "Substituição por Macros — Antifofista Squad" },
    { property: "og:description", content: "Troque alimentos do mesmo grupo igualando proteína, carboidrato ou gordura." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MacroPage,
});

type DietFood = { alimento: string; quantidade?: string; medida?: string };

function useDietFoods(): DietFood[] {
  const fetchDiet = useServerFn(getMyDiet);
  const { data: res } = useQuery({ queryKey: ["my-diet"], queryFn: () => fetchDiet() });
  const plan = (res?.data as DietPlan | undefined) ?? null;
  return useMemo(() => {
    const seen = new Set<string>();
    const out: DietFood[] = [];
    (plan?.refeicoes ?? []).forEach((m) =>
      (m.itens ?? []).forEach((it) => {
        const alimento = it.alimento?.trim();
        if (!alimento || seen.has(alimento.toLowerCase())) return;
        seen.add(alimento.toLowerCase());
        out.push({ alimento, quantidade: it.quantidade, medida: it.medida });
      }),
    );
    return out;
  }, [plan]);
}

const sorted = MACRO_FOODS.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

function MacroPage() {
  const dietFoods = useDietFoods();
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [qty, setQty] = useState("");

  const origin = fromName ? findFood(fromName) : undefined;
  const options = useMemo(
    () => (origin ? eligibleSubstitutes(origin).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) : []),
    [origin],
  );
  const sub = toName ? options.find((o) => o.nome === toName) : undefined;
  const q = parseFloat(qty.replace(",", "."));
  const result = origin && sub && q > 0 ? calcMacroSubstitution(origin, sub, q) : null;

  function pick(food: DietFood) {
    const m = matchMacroFood(food.alimento);
    if (!m) return;
    setFromName(m.nome);
    setToName("");
    const n = parseFloat((food.quantidade ?? "").replace(",", "."));
    setQty(Number.isFinite(n) && n > 0 ? String(n) : "");
  }

  const matched = dietFoods.filter((f) => matchMacroFood(f.alimento));

  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">CALCULADORA</p>
        <h1 className="tactical-heading text-2xl">SUBSTITUIÇÃO POR MACROS</h1>
        <div className="tactical-divider mt-2" />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-foreground font-medium">
          Troca só dentro do mesmo grupo, igualando a proteína, o carboidrato ou a gordura. Frutas trocam no mesmo peso. Valores arredondados para baixo.
        </p>
      </div>

      {matched.length > 0 && (
        <Card className="p-4 space-y-3">
          <p className="tactical-heading text-xs text-primary tracking-widest">DA SUA DIETA</p>
          <div className="flex flex-wrap gap-2">
            {matched.map((f, i) => {
              const active = matchMacroFood(f.alimento)?.nome === fromName;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(f)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary"
                  }`}
                >
                  {f.alimento}
                  {f.quantidade ? (
                    <span className="text-muted-foreground"> · {f.quantidade}{f.medida ? ` ${f.medida}` : ""}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="space-y-1.5">
          <p className="tactical-heading text-[10px] text-muted-foreground tracking-widest">ALIMENTO DA DIETA</p>
          <Select value={fromName} onValueChange={(v) => { setFromName(v); setToName(""); }}>
            <SelectTrigger><SelectValue placeholder="Escolha o alimento" /></SelectTrigger>
            <SelectContent>
              {sorted.map((f) => (
                <SelectItem key={f.nome} value={f.nome}>{f.nome} ({f.medida})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {origin && (
            <p className="text-[11px] text-muted-foreground">Grupo: {GROUP_LABEL[origin.grupo]}</p>
          )}
        </div>

        {origin && origin.grupo === "sem_troca" ? (
          <p className="text-sm text-foreground text-center py-2">
            Este alimento não tem substituição — mantenha como está na dieta.
          </p>
        ) : origin ? (
          <>
            <div className="space-y-1.5">
              <p className="tactical-heading text-[10px] text-muted-foreground tracking-widest">
                QUANTIDADE NA DIETA ({origin.medida})
              </p>
              <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Ex.: 100" />
            </div>
            <div className="space-y-1.5">
              <p className="tactical-heading text-[10px] text-muted-foreground tracking-widest">TROCAR POR</p>
              <Select value={toName} onValueChange={setToName}>
                <SelectTrigger><SelectValue placeholder="Escolha o substituto" /></SelectTrigger>
                <SelectContent>
                  {options.map((f) => (
                    <SelectItem key={f.nome} value={f.nome}>{f.nome} ({f.medida})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {result && sub && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center justify-center gap-3 text-center">
                  <div>
                    <p className="tactical-heading text-lg">{formatNum(q)} {origin.medida}</p>
                    <p className="text-[11px] text-muted-foreground">{origin.nome}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="tactical-heading text-2xl text-primary">{formatNum(result.quantidade)} {sub.medida}</p>
                    <p className="text-[11px] text-muted-foreground">{sub.nome}</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Calorias: {Math.round(result.kcalOrigem)} kcal → {Math.round(result.kcalSubstituto)} kcal
                </p>
              </div>
            )}
          </>
        ) : null}
      </Card>
    </div>
  );
}
