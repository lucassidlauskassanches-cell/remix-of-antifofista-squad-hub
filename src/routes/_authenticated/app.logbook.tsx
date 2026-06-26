import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  getMyLogbook,
  saveLogbookEntry,
  deleteLogbookEntry,
} from "@/lib/squad.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Check, X, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/logbook")({
  component: LogbookPage,
});

function todayInput() {
  return new Date().toISOString().split("T")[0];
}

type Row = {
  id: string;
  exercise: string;
  load: string;
  reps: string;
  entry_date: string;
  order_index: number;
};

function LogbookPage() {
  const fetchRows = useServerFn(getMyLogbook);
  const save = useServerFn(saveLogbookEntry);
  const del = useServerFn(deleteLogbookEntry);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-logbook"],
    queryFn: () => fetchRows(),
  });

  const [draft, setDraft] = useState({ exercise: "", load: "", reps: "", entry_date: todayInput() });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ exercise: "", load: "", reps: "", entry_date: "" });
  const [search, setSearch] = useState("");

  const rawRows: Row[] = (data?.rows ?? []) as any;

  const rows = useMemo(() => {
    const sorted = [...rawRows].sort((a, b) => {
      const byName = a.exercise.localeCompare(b.exercise, "pt-BR", { sensitivity: "base" });
      if (byName !== 0) return byName;
      const byDate = (a.entry_date || "").localeCompare(b.entry_date || "");
      if (byDate !== 0) return byDate;
      return a.order_index - b.order_index;
    });
    if (!search.trim()) return sorted;
    const s = search.trim().toLowerCase();
    return sorted.filter((r) => r.exercise.toLowerCase().includes(s));
  }, [rawRows, search]);

  function reload() {
    qc.invalidateQueries({ queryKey: ["my-logbook"] });
  }

  async function handleAdd() {
    try {
      await save({
        data: {
          exercise: draft.exercise,
          load: draft.load,
          reps: draft.reps,
          entry_date: draft.entry_date,
          order_index: rows.length,
        },
      });
      setDraft({ exercise: "", load: "", reps: "", entry_date: todayInput() });
      reload();
      toast.success("Linha adicionada");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    }
  }

  function startEdit(r: Row) {
    setEditingId(r.id);
    setEditDraft({
      exercise: r.exercise,
      load: r.load,
      reps: r.reps,
      entry_date: r.entry_date || todayInput(),
    });
  }

  async function commitEdit(r: Row) {
    try {
      await save({
        data: {
          id: r.id,
          exercise: editDraft.exercise,
          load: editDraft.load,
          reps: editDraft.reps,
          entry_date: editDraft.entry_date,
          order_index: r.order_index,
        },
      });
      setEditingId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta linha?")) return;
    try {
      await del({ data: { id } });
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">CADERNO</p>
        <h1 className="tactical-heading text-2xl">Logbook</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Registre data, exercício, carga e repetições. Seu treinador pode visualizar.
        </p>
        <div className="tactical-divider mt-2" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar exercício..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_1.3fr_0.8fr_0.8fr_auto] gap-2 px-3 py-2 bg-secondary/40 border-b border-border">
          <span className="tactical-heading text-[10px] tracking-widest text-primary">DATA</span>
          <span className="tactical-heading text-[10px] tracking-widest text-primary">EXERCÍCIO</span>
          <span className="tactical-heading text-[10px] tracking-widest text-primary">CARGA</span>
          <span className="tactical-heading text-[10px] tracking-widest text-primary">REPS</span>
          <span className="w-16" />
        </div>

        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {search.trim() ? "Nenhum exercício encontrado." : "Nenhum registro ainda."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <li
                  key={r.id}
                  className="grid grid-cols-[1fr_1.3fr_0.8fr_0.8fr_auto] gap-2 items-center px-3 py-2"
                >
                  {isEditing ? (
                    <>
                      <Input
                        type="date"
                        value={editDraft.entry_date}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, entry_date: e.target.value }))
                        }
                        className="h-9"
                      />
                      <Input
                        value={editDraft.exercise}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, exercise: e.target.value }))
                        }
                        className="h-9"
                      />
                      <Input
                        value={editDraft.load}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, load: e.target.value }))
                        }
                        className="h-9"
                      />
                      <Input
                        value={editDraft.reps}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, reps: e.target.value }))
                        }
                        className="h-9"
                      />
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => commitEdit(r)}>
                          <Check className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-sm truncate">{formatDate(r.entry_date)}</span>
                      <span className="text-sm truncate">{r.exercise || "—"}</span>
                      <span className="text-sm truncate">{r.load || "—"}</span>
                      <span className="text-sm truncate">{r.reps || "—"}</span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid grid-cols-[1fr_1.3fr_0.8fr_0.8fr_auto] gap-2 items-center px-3 py-2 border-t border-border bg-secondary/20">
          <Input
            type="date"
            value={draft.entry_date}
            onChange={(e) => setDraft((d) => ({ ...d, entry_date: e.target.value }))}
            className="h-9"
          />
          <Input
            placeholder="Exercício"
            value={draft.exercise}
            onChange={(e) => setDraft((d) => ({ ...d, exercise: e.target.value }))}
            className="h-9"
          />
          <Input
            placeholder="Carga"
            value={draft.load}
            onChange={(e) => setDraft((d) => ({ ...d, load: e.target.value }))}
            className="h-9"
          />
          <Input
            placeholder="Reps"
            value={draft.reps}
            onChange={(e) => setDraft((d) => ({ ...d, reps: e.target.value }))}
            className="h-9"
          />
          <Button size="icon" onClick={handleAdd} aria-label="Adicionar">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}
