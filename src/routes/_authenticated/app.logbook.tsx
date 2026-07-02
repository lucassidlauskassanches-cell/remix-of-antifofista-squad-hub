import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getMyLogbook, deleteLogbookEntry } from "@/lib/squad.functions";
import { Input } from "@/components/ui/input";
import { Search, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/logbook")({
  component: EvolucaoPage,
});

type Row = {
  id: string;
  exercise: string;
  load: string;
  reps: string;
  entry_date: string;
  order_index: number;
};

type Group = {
  exercise: string;
  entries: Row[]; // ordenado por data crescente
  numeric: { value: number; date: string }[];
  lastDate: string;
};

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function parseLoad(load: string): number | null {
  if (!load) return null;
  const m = load.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function EvolucaoPage() {
  const fetchRows = useServerFn(getMyLogbook);
  const del = useServerFn(deleteLogbookEntry);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-logbook"],
    queryFn: () => fetchRows(),
  });

  const [search, setSearch] = useState("");
  const rawRows: Row[] = (data?.rows ?? []) as any;

  const groups = useMemo(() => {
    const byKey = new Map<string, Group>();
    rawRows.forEach((r) => {
      const key = normalize(r.exercise);
      if (!key) return;
      let g = byKey.get(key);
      if (!g) {
        g = { exercise: r.exercise, entries: [], numeric: [], lastDate: "" };
        byKey.set(key, g);
      }
      g.entries.push(r);
    });
    const out = [...byKey.values()].map((g) => {
      const entries = [...g.entries].sort((a, b) =>
        (a.entry_date || "").localeCompare(b.entry_date || ""),
      );
      const numeric = entries
        .map((e) => ({ value: parseLoad(e.load), date: e.entry_date }))
        .filter((p): p is { value: number; date: string } => p.value !== null);
      return {
        ...g,
        entries,
        numeric,
        lastDate: entries[entries.length - 1]?.entry_date || "",
      };
    });
    out.sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
    if (!search.trim()) return out;
    const s = normalize(search);
    return out.filter((g) => normalize(g.exercise).includes(s));
  }, [rawRows, search]);

  async function handleDelete(id: string) {
    if (!confirm("Remover este registro?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["my-logbook"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  return (
    <div>
      <div className="af-eyebrow">Sua evolução</div>
      <div className="af-title">Evolução</div>

      {rawRows.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar exercício..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-center py-16 text-muted-foreground">Carregando...</p>
      ) : rawRows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <TrendingUp className="w-8 h-8 mx-auto opacity-50" />
          <p className="text-sm">
            Ainda sem registros. Quando você anotar a carga na tela de treino,
            sua evolução aparece aqui.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-center py-16 text-muted-foreground text-sm">
          Nenhum exercício encontrado.
        </p>
      ) : (
        <div>
          {groups.map((g) => (
            <ExerciseProgress key={g.exercise} group={g} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseProgress({
  group,
  onDelete,
}: {
  group: Group;
  onDelete: (id: string) => void;
}) {
  const { numeric } = group;
  const latest = numeric[numeric.length - 1]?.value ?? null;
  const prev = numeric.length > 1 ? numeric[numeric.length - 2].value : null;
  const delta = latest !== null && prev !== null ? Math.round((latest - prev) * 10) / 10 : null;
  const recent = [...group.entries].reverse().slice(0, 6);

  return (
    <div className="af-evo">
      <div className="eh">
        <div className="e">{group.exercise}</div>
        {latest !== null && (
          <div className="big">
            <span className="v">{latest}</span>
            <span className="u"> kg</span>
            {delta !== null && delta !== 0 && (
              <div className="up" style={delta < 0 ? { color: "var(--color-muted-foreground)" } : undefined}>
                {delta > 0 ? "▲ +" : "▼ "}
                {delta}kg
              </div>
            )}
          </div>
        )}
      </div>

      {numeric.length >= 2 && (
        <div className="af-spark">
          <Sparkline points={numeric.map((n) => n.value)} />
        </div>
      )}

      <ul className="mt-3 divide-y divide-border">
        {recent.map((e) => (
          <li
            key={e.id}
            className="grid grid-cols-[auto_1fr_auto] gap-3 items-center py-1.5 text-sm"
          >
            <span className="text-xs text-muted-foreground w-12">{formatDate(e.entry_date)}</span>
            <span className="truncate">
              {e.load || "—"}
              {e.reps ? <span className="text-muted-foreground"> · {e.reps} reps</span> : null}
            </span>
            <button
              type="button"
              className="h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground"
              onClick={() => onDelete(e.id)}
              aria-label="Remover registro"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const n = points.length;
  const coords = points.map((v, i) => {
    const x = n === 1 ? 150 : 5 + (i / (n - 1)) * 290;
    const y = 52 - ((v - min) / span) * 44;
    return { x, y };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  return (
    <svg
      viewBox="0 0 300 60"
      preserveAspectRatio="none"
      width="100%"
      style={{ display: "block" }}
      aria-hidden
    >
      <path
        d={line}
        fill="none"
        stroke="var(--red-2)"
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r={3.4} fill="var(--red-2)" />
    </svg>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const [, m, d] = value.split("-");
  return `${d}/${m}`;
}
