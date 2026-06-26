import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getMyLogbook,
  saveLogbookEntry,
  deleteLogbookEntry,
} from "@/lib/squad.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/logbook")({
  component: LogbookPage,
});

type Row = {
  id: string;
  exercise: string;
  load: string;
  reps: string;
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

  const [draft, setDraft] = useState({ exercise: "", load: "", reps: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ exercise: "", load: "", reps: "" });

  const rows: Row[] = (data?.rows ?? []) as any;

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
          order_index: rows.length,
        },
      });
      setDraft({ exercise: "", load: "", reps: "" });
      reload();
      toast.success("Linha adicionada");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    }
  }

  function startEdit(r: Row) {
    setEditingId(r.id);
    setEditDraft({ exercise: r.exercise, load: r.load, reps: r.reps });
  }

  async function commitEdit(r: Row) {
    try {
      await save({
        data: {
          id: r.id,
          exercise: editDraft.exercise,
          load: editDraft.load,
          reps: editDraft.reps,
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
          Registre exercício, carga e repetições. Seu treinador pode visualizar.
        </p>
        <div className="tactical-divider mt-2" />
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_auto] gap-2 px-3 py-2 bg-secondary/40 border-b border-border">
          <span className="tactical-heading text-[10px] tracking-widest text-primary">EXERCÍCIO</span>
          <span className="tactical-heading text-[10px] tracking-widest text-primary">CARGA</span>
          <span className="tactical-heading text-[10px] tracking-widest text-primary">REPS</span>
          <span className="w-16" />
        </div>

        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <li
                  key={r.id}
                  className="grid grid-cols-[1.4fr_0.9fr_0.9fr_auto] gap-2 items-center px-3 py-2"
                >
                  {isEditing ? (
                    <>
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

        <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_auto] gap-2 items-center px-3 py-2 border-t border-border bg-secondary/20">
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
