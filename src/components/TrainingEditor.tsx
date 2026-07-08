import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, X } from "lucide-react";
import type {
  StructuredPlan,
  StructuredBlock,
  StructuredExercise,
} from "@/lib/training-xlsx-parser";
import { saveStructuredTrainingPlan } from "@/lib/squad.functions";

type Section = "blocks" | "abdomen" | "cardio";

export function TrainingEditor({
  studentId,
  sourceName,
  initial,
  onSaved,
  onCancel,
}: {
  studentId: string;
  sourceName: string;
  initial: StructuredPlan;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const save = useServerFn(saveStructuredTrainingPlan);
  const [plan, setPlan] = useState<StructuredPlan>(() =>
    JSON.parse(JSON.stringify(initial)),
  );
  const [busy, setBusy] = useState(false);

  const weekCount = plan.weeks.length;

  function padWeeks(arr: string[]): string[] {
    const out = arr.slice(0, weekCount);
    while (out.length < weekCount) out.push("");
    return out;
  }

  function updateWeekLabel(k: number, value: string) {
    setPlan((p) => {
      const weeks = [...p.weeks];
      weeks[k] = value;
      return { ...p, weeks };
    });
  }
  function addWeek() {
    setPlan((p) => ({
      ...p,
      weeks: [...p.weeks, `Semana ${p.weeks.length + 1}`],
      blocks: p.blocks.map((b) => ({
        ...b,
        exercises: b.exercises.map((e) => ({ ...e, weeks: [...e.weeks, ""] })),
      })),
      abdomen: p.abdomen.map((e) => ({ ...e, weeks: [...e.weeks, ""] })),
      cardio: p.cardio.map((e) => ({ ...e, weeks: [...e.weeks, ""] })),
    }));
  }
  function removeWeek(k: number) {
    setPlan((p) => ({
      ...p,
      weeks: p.weeks.filter((_, i) => i !== k),
      blocks: p.blocks.map((b) => ({
        ...b,
        exercises: b.exercises.map((e) => ({
          ...e,
          weeks: e.weeks.filter((_, i) => i !== k),
        })),
      })),
      abdomen: p.abdomen.map((e) => ({
        ...e,
        weeks: e.weeks.filter((_, i) => i !== k),
      })),
      cardio: p.cardio.map((e) => ({
        ...e,
        weeks: e.weeks.filter((_, i) => i !== k),
      })),
    }));
  }

  function updateBlock(bi: number, patch: Partial<StructuredBlock>) {
    setPlan((p) => {
      const blocks = [...p.blocks];
      blocks[bi] = { ...blocks[bi], ...patch };
      return { ...p, blocks };
    });
  }
  function addBlock() {
    const letters = ["A", "B", "C", "D", "E", "F", "G"];
    const next = letters[plan.blocks.length] ?? String(plan.blocks.length + 1);
    setPlan((p) => ({
      ...p,
      blocks: [
        ...p.blocks,
        { name: `Treino ${next}`, day: null, exercises: [] },
      ],
    }));
  }
  function removeBlock(bi: number) {
    if (!confirm("Remover este treino?")) return;
    setPlan((p) => ({ ...p, blocks: p.blocks.filter((_, i) => i !== bi) }));
  }

  function updateBlockExercise(
    bi: number,
    ei: number,
    patch: Partial<StructuredExercise>,
  ) {
    setPlan((p) => {
      const blocks = [...p.blocks];
      const exercises = [...blocks[bi].exercises];
      exercises[ei] = { ...exercises[ei], ...patch };
      blocks[bi] = { ...blocks[bi], exercises };
      return { ...p, blocks };
    });
  }
  function updateBlockWeek(bi: number, ei: number, k: number, value: string) {
    setPlan((p) => {
      const blocks = [...p.blocks];
      const exercises = [...blocks[bi].exercises];
      const weeks = padWeeks(exercises[ei].weeks);
      weeks[k] = value;
      exercises[ei] = { ...exercises[ei], weeks };
      blocks[bi] = { ...blocks[bi], exercises };
      return { ...p, blocks };
    });
  }
  function addBlockExercise(bi: number) {
    setPlan((p) => {
      const blocks = [...p.blocks];
      blocks[bi] = {
        ...blocks[bi],
        exercises: [
          ...blocks[bi].exercises,
          { name: "", weeks: Array(weekCount).fill(""), note: "" },
        ],
      };
      return { ...p, blocks };
    });
  }
  function removeBlockExercise(bi: number, ei: number) {
    setPlan((p) => {
      const blocks = [...p.blocks];
      blocks[bi] = {
        ...blocks[bi],
        exercises: blocks[bi].exercises.filter((_, i) => i !== ei),
      };
      return { ...p, blocks };
    });
  }

  function updateSectionExercise(
    section: "abdomen" | "cardio",
    ei: number,
    patch: Partial<StructuredExercise>,
  ) {
    setPlan((p) => {
      const list = [...p[section]];
      list[ei] = { ...list[ei], ...patch };
      return { ...p, [section]: list } as StructuredPlan;
    });
  }
  function updateSectionWeek(
    section: "abdomen" | "cardio",
    ei: number,
    k: number,
    value: string,
  ) {
    setPlan((p) => {
      const list = [...p[section]];
      const weeks = padWeeks(list[ei].weeks);
      weeks[k] = value;
      list[ei] = { ...list[ei], weeks };
      return { ...p, [section]: list } as StructuredPlan;
    });
  }
  function addSectionExercise(section: "abdomen" | "cardio") {
    setPlan((p) => ({
      ...p,
      [section]: [
        ...p[section],
        { name: "", weeks: Array(weekCount).fill(""), note: "" },
      ],
    }));
  }
  function removeSectionExercise(section: "abdomen" | "cardio", ei: number) {
    setPlan((p) => ({
      ...p,
      [section]: p[section].filter((_, i) => i !== ei),
    }));
  }

  function updateTip(i: number, value: string) {
    setPlan((p) => {
      const tips = [...p.tips];
      tips[i] = value;
      return { ...p, tips };
    });
  }
  function addTip() {
    setPlan((p) => ({ ...p, tips: [...p.tips, ""] }));
  }
  function removeTip(i: number) {
    setPlan((p) => ({ ...p, tips: p.tips.filter((_, k) => k !== i) }));
  }

  async function handleSave() {
    const cleanEx = (ex: StructuredExercise): StructuredExercise => ({
      name: ex.name.trim(),
      weeks: padWeeks(ex.weeks).map((w) => w.trim()),
      note: ex.note.trim(),
    });
    const cleaned: StructuredPlan = {
      weeks: plan.weeks.map((w) => w.trim() || "Semana"),
      blocks: plan.blocks
        .map((b) => ({
          name: b.name.trim() || "Treino",
          day: b.day?.trim() || null,
          exercises: b.exercises.map(cleanEx).filter((e) => e.name),
        }))
        .filter((b) => b.exercises.length > 0),
      abdomen: plan.abdomen.map(cleanEx).filter((e) => e.name),
      cardio: plan.cardio.map(cleanEx).filter((e) => e.name),
      tips: plan.tips.map((t) => t.trim()).filter(Boolean),
    };
    setBusy(true);
    try {
      await save({
        data: {
          studentId,
          sourceName: sourceName || "treino.xlsx",
          plan: cleaned,
        },
      });
      toast.success("Treino atualizado");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  function renderExerciseRow(
    ex: StructuredExercise,
    onName: (v: string) => void,
    onWeek: (k: number, v: string) => void,
    onNote: (v: string) => void,
    onRemove: () => void,
  ) {
    return (
      <div className="space-y-1 rounded-md border border-border p-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Exercício"
            value={ex.name}
            onChange={(e) => onName(e.target.value)}
            className="font-medium"
          />
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive shrink-0"
            onClick={onRemove}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${weekCount}, minmax(80px, 1fr))`,
          }}
        >
          {padWeeks(ex.weeks).map((v, k) => (
            <Input
              key={k}
              placeholder={plan.weeks[k] ?? `S${k + 1}`}
              value={v}
              onChange={(e) => onWeek(k, e.target.value)}
              className="text-xs h-8"
            />
          ))}
        </div>
        <Input
          placeholder="Observação"
          value={ex.note}
          onChange={(e) => onNote(e.target.value)}
          className="text-xs h-8"
        />
      </div>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="tactical-heading text-xs text-primary tracking-widest">
          EDITAR TREINO
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

      {/* Weeks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground">
            SEMANAS
          </p>
          <Button size="sm" variant="outline" onClick={addWeek}>
            <Plus className="w-3 h-3 mr-1" /> Semana
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.weeks.map((w, k) => (
            <div key={k} className="flex items-center gap-1">
              <Input
                value={w}
                onChange={(e) => updateWeekLabel(k, e.target.value)}
                className="h-8 w-32 text-xs"
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive h-8 px-2"
                onClick={() => removeWeek(k)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground">
            TREINOS
          </p>
          <Button size="sm" variant="outline" onClick={addBlock}>
            <Plus className="w-3 h-3 mr-1" /> Treino
          </Button>
        </div>
        {plan.blocks.map((b, bi) => (
          <div key={bi} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={b.name}
                onChange={(e) => updateBlock(bi, { name: e.target.value })}
                className="font-semibold"
                placeholder="Nome do treino"
              />
              <Input
                value={b.day ?? ""}
                onChange={(e) => updateBlock(bi, { day: e.target.value })}
                placeholder="Dia (ex: Segunda)"
                className="w-40"
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => removeBlock(bi)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {b.exercises.map((ex, ei) => (
              <div key={ei}>
                {renderExerciseRow(
                  ex,
                  (v) => updateBlockExercise(bi, ei, { name: v }),
                  (k, v) => updateBlockWeek(bi, ei, k, v),
                  (v) => updateBlockExercise(bi, ei, { note: v }),
                  () => removeBlockExercise(bi, ei),
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => addBlockExercise(bi)}
            >
              <Plus className="w-3 h-3 mr-1" /> Exercício
            </Button>
          </div>
        ))}
      </div>

      {/* Section: Abdominal & Cardio */}
      {(["abdomen", "cardio"] as const).map((section) => (
        <div key={section} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground">
              {section === "abdomen" ? "ABDOMINAL" : "CARDIO"}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addSectionExercise(section)}
            >
              <Plus className="w-3 h-3 mr-1" /> Exercício
            </Button>
          </div>
          {plan[section].map((ex, ei) => (
            <div key={ei}>
              {renderExerciseRow(
                ex,
                (v) => updateSectionExercise(section, ei, { name: v }),
                (k, v) => updateSectionWeek(section, ei, k, v),
                (v) => updateSectionExercise(section, ei, { note: v }),
                () => removeSectionExercise(section, ei),
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Tips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground">
            DICAS E CONSIDERAÇÕES
          </p>
          <Button size="sm" variant="outline" onClick={addTip}>
            <Plus className="w-3 h-3 mr-1" /> Dica
          </Button>
        </div>
        {plan.tips.map((t, i) => (
          <div key={i} className="flex items-start gap-2">
            <Textarea
              rows={2}
              value={t}
              onChange={(e) => updateTip(i, e.target.value)}
            />
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => removeTip(i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          <X className="w-4 h-4 mr-1" /> Cancelar
        </Button>
        <Button onClick={handleSave} disabled={busy}>
          <Save className="w-4 h-4 mr-1" />{" "}
          {busy ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </Card>
  );
}
