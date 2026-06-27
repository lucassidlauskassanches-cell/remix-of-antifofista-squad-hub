import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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

export const Route = createFileRoute("/_authenticated/app/nutricional/substituicoes")({
  component: SubstPage,
});

type Item = {
  name: string;
  qtdBase: number;
  unidBase: string;
  qtdAlim: number;
  unidAlim: string;
};

const GROUPS: { key: keyof typeof data; label: string; emoji: string }[] = [
  { key: "proteinas", label: "PROTEÍNAS", emoji: "🥩" },
  { key: "carboidratos", label: "CARBOIDRATOS", emoji: "🍚" },
  { key: "frutas", label: "FRUTAS", emoji: "🍌" },
  { key: "gorduras", label: "GORDURAS", emoji: "🥑" },
  { key: "lowfat", label: "LOW FAT", emoji: "🥗" },
];

function Calculator({ items }: { items: Item[] }) {
  const [fromName, setFromName] = useState<string>("");
  const [toName, setToName] = useState<string>("");
  const [weight, setWeight] = useState<string>("");

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
          <Select value={fromName} onValueChange={setFromName}>
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
            onChange={(e) => setWeight(e.target.value)}
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
          <Select value={toName} onValueChange={setToName}>
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
        ℹ️ Todas as trocas são equivalentes dentro do mesmo grupo.
      </p>
    </div>
  );
}

function SubstPage() {
  const [group, setGroup] = useState<keyof typeof data>("proteinas");
  const items = (data[group] as Item[]).slice().sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">CALCULADORA</p>
        <h1 className="tactical-heading text-2xl">SUBSTITUIÇÃO ALIMENTAR</h1>
        <div className="tactical-divider mt-2" />
      </div>

      <div className="grid grid-cols-5 gap-1 p-1 bg-card rounded-md border border-border">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setGroup(g.key)}
            className={`tactical-heading text-[10px] py-2 rounded flex flex-col items-center gap-0.5 ${
              group === g.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <span className="text-base leading-none">{g.emoji}</span>
            <span className="tracking-wider">{g.label}</span>
          </button>
        ))}
      </div>

      <Calculator key={group} items={items} />
    </div>
  );
}
