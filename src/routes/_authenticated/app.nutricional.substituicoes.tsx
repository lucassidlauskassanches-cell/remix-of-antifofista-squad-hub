import { createFileRoute } from "@tanstack/react-router";
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

const GROUPS: { key: keyof typeof data; label: string }[] = [
  { key: "proteinas", label: "Proteínas" },
  { key: "carboidratos", label: "Carboidratos" },
  { key: "frutas", label: "Frutas" },
  { key: "gorduras", label: "Gorduras" },
  { key: "lowfat", label: "Lowfat" },
];

function SubstPage() {
  return (
    <div>
      {GROUPS.map((g) => {
        const items = (data[g.key] as Item[]) ?? [];
        if (!items.length) return null;
        const sorted = [...items].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR"),
        );
        return (
          <section key={g.key} className="mb-6">
            <div className="af-sec">
              <span>{g.label}</span>
              <div className="ln" />
            </div>
            <div className="af-ex p-0 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 tactical-heading text-[10px] tracking-widest text-muted-foreground">
                      Alimento
                    </th>
                    <th className="text-right px-3 py-2 tactical-heading text-[10px] tracking-widest text-muted-foreground whitespace-nowrap">
                      Quantidade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((it, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 align-top">{it.name}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        {it.qtdAlim}
                        {it.unidAlim}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
