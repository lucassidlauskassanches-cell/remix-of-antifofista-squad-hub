import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Pencil, X } from "lucide-react";
import type { DietPlan, Meal, MealItem, Supplement } from "@/lib/diet-xlsx-parser";
import { saveDiet } from "@/lib/squad.functions";

export function DietEditor({
  studentId,
  sourceName,
  initial,
  onSaved,
  onCancel,
}: {
  studentId: string;
  sourceName: string;
  initial: DietPlan;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const save = useServerFn(saveDiet);
  const [plan, setPlan] = useState<DietPlan>(() =>
    JSON.parse(JSON.stringify(initial)),
  );
  const [busy, setBusy] = useState(false);

  function updateSup(i: number, patch: Partial<Supplement>) {
    setPlan((p) => {
      const sups = [...p.suplementos];
      sups[i] = { ...sups[i], ...patch };
      return { ...p, suplementos: sups };
    });
  }
  function addSup() {
    setPlan((p) => ({
      ...p,
      suplementos: [...p.suplementos, { nome: "", dose: "", horario: "" }],
    }));
  }
  function removeSup(i: number) {
    setPlan((p) => ({
      ...p,
      suplementos: p.suplementos.filter((_, k) => k !== i),
    }));
  }

  function updateMeal(mi: number, patch: Partial<Meal>) {
    setPlan((p) => {
      const meals = [...p.refeicoes];
      meals[mi] = { ...meals[mi], ...patch };
      return { ...p, refeicoes: meals };
    });
  }
  function addMeal() {
    setPlan((p) => ({
      ...p,
      refeicoes: [...p.refeicoes, { nome: "Nova refeição", itens: [] }],
    }));
  }
  function removeMeal(mi: number) {
    setPlan((p) => ({
      ...p,
      refeicoes: p.refeicoes.filter((_, k) => k !== mi),
    }));
  }
  function updateItem(mi: number, ii: number, patch: Partial<MealItem>) {
    setPlan((p) => {
      const meals = [...p.refeicoes];
      const itens = [...meals[mi].itens];
      itens[ii] = { ...itens[ii], ...patch };
      meals[mi] = { ...meals[mi], itens };
      return { ...p, refeicoes: meals };
    });
  }
  function addItem(mi: number) {
    setPlan((p) => {
      const meals = [...p.refeicoes];
      meals[mi] = {
        ...meals[mi],
        itens: [...meals[mi].itens, { alimento: "", quantidade: "", medida: "" }],
      };
      return { ...p, refeicoes: meals };
    });
  }
  function removeItem(mi: number, ii: number) {
    setPlan((p) => {
      const meals = [...p.refeicoes];
      meals[mi] = {
        ...meals[mi],
        itens: meals[mi].itens.filter((_, k) => k !== ii),
      };
      return { ...p, refeicoes: meals };
    });
  }

  async function handleSave() {
    // Clean: drop fully-empty items and meals
    const cleaned: DietPlan = {
      suplementos: plan.suplementos
        .map((s) => ({
          nome: s.nome.trim(),
          dose: s.dose.trim(),
          horario: s.horario.trim(),
        }))
        .filter((s) => s.nome),
      refeicoes: plan.refeicoes
        .map((m) => ({
          nome: m.nome.trim() || "Refeição",
          itens: m.itens
            .map((i) => ({
              alimento: i.alimento.trim(),
              quantidade: i.quantidade.trim(),
              medida: i.medida.trim(),
            }))
            .filter((i) => isVisibleMealItem(i.alimento)),
        }))
        .filter((m) => m.itens.length > 0),
      observacoes: plan.observacoes?.trim() ?? "",
    };
    setBusy(true);
    try {
      await save({
        data: { studentId, sourceName: sourceName || "dieta.xlsx", plan: cleaned },
      });
      toast.success("Dieta atualizada");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="tactical-heading text-xs text-primary tracking-widest">
          EDITAR DIETA
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={busy}>
            <Save className="w-4 h-4 mr-1" /> {busy ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Suplementos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground">
            SUPLEMENTAÇÃO E MANIPULADOS
          </p>
          <Button size="sm" variant="outline" onClick={addSup}>
            <Plus className="w-3 h-3 mr-1" /> Suplemento
          </Button>
        </div>
        {plan.suplementos.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum suplemento.</p>
        )}
        {plan.suplementos.map((s, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <Input
              className="col-span-4"
              placeholder="Nome"
              value={s.nome}
              onChange={(e) => updateSup(i, { nome: e.target.value })}
            />
            <Input
              className="col-span-3"
              placeholder="Dose"
              value={s.dose}
              onChange={(e) => updateSup(i, { dose: e.target.value })}
            />
            <Input
              className="col-span-4"
              placeholder="Horário"
              value={s.horario}
              onChange={(e) => updateSup(i, { horario: e.target.value })}
            />
            <Button
              size="sm"
              variant="ghost"
              className="col-span-1 text-destructive"
              onClick={() => removeSup(i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Refeições */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground">
            REFEIÇÕES
          </p>
          <Button size="sm" variant="outline" onClick={addMeal}>
            <Plus className="w-3 h-3 mr-1" /> Refeição
          </Button>
        </div>
        {plan.refeicoes.map((m, mi) => (
          <div key={mi} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={m.nome}
                onChange={(e) => updateMeal(mi, { nome: e.target.value })}
                className="font-semibold"
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => removeMeal(mi)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {m.itens.map((it, ii) => (
              <div key={ii} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  className="col-span-6"
                  placeholder="Alimento"
                  value={it.alimento}
                  onChange={(e) =>
                    updateItem(mi, ii, { alimento: e.target.value })
                  }
                />
                <Input
                  className="col-span-2"
                  placeholder="Qtd."
                  value={it.quantidade}
                  onChange={(e) =>
                    updateItem(mi, ii, { quantidade: e.target.value })
                  }
                />
                <Input
                  className="col-span-3"
                  placeholder="Medida"
                  value={it.medida}
                  onChange={(e) =>
                    updateItem(mi, ii, { medida: e.target.value })
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="col-span-1 text-destructive"
                  onClick={() => removeItem(mi, ii)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => addItem(mi)}>
              <Plus className="w-3 h-3 mr-1" /> Item
            </Button>
          </div>
        ))}
      </div>

      {/* Observações */}
      <div className="space-y-1">
        <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground">
          OBSERVAÇÕES
        </p>
        <Textarea
          rows={3}
          value={plan.observacoes ?? ""}
          onChange={(e) => setPlan((p) => ({ ...p, observacoes: e.target.value }))}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          <X className="w-4 h-4 mr-1" /> Cancelar
        </Button>
        <Button onClick={handleSave} disabled={busy}>
          <Save className="w-4 h-4 mr-1" /> {busy ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

      {/* sentinel to silence unused import warning if Pencil ever removed */}
      <Pencil className="hidden" />
    </Card>
  );
}

function isVisibleMealItem(alimento: string) {
  const normalized = alimento
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return /[a-z]/.test(normalized) && !["observacoes", "observacao", "obs", "alimento", "qtd", "quantidade", "medida"].includes(normalized);
}
