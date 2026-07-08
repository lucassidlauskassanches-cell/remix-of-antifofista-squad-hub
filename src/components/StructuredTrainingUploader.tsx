import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Trash2, Pencil } from "lucide-react";
import {
  parseTrainingXlsx,
  type StructuredPlan,
} from "@/lib/training-xlsx-parser";
import {
  saveStructuredTrainingPlan,
  deleteStructuredTrainingPlan,
} from "@/lib/squad.functions";
import { TrainingEditor } from "@/components/TrainingEditor";

export function StructuredTrainingUploader({
  studentId,
  current,
  onChanged,
}: {
  studentId: string;
  current: { source_name?: string | null; plan?: StructuredPlan | null; updated_at?: string } | null;
  onChanged: () => void;
}) {
  const save = useServerFn(saveStructuredTrainingPlan);
  const del = useServerFn(deleteStructuredTrainingPlan);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const plan = await parseTrainingXlsx(file);
      if (!plan.blocks.length) throw new Error("Nenhum bloco de treino encontrado.");
      await save({
        data: { studentId, sourceName: file.name, plan },
      });
      toast.success(
        `Planilha lida: ${plan.blocks.length} treino(s), ${plan.weeks.length} semana(s).`,
      );
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao ler a planilha.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm("Remover a planilha estruturada?")) return;
    try {
      await del({ data: { studentId } });
      toast.success("Removido");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  }

  const plan = current?.plan as StructuredPlan | undefined;
  const has = !!plan && (plan.blocks?.length ?? 0) > 0;

  return (
    <Card className="p-4 space-y-3">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          PLANILHA ESTRUTURADA (XLSX)
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Envie o Excel para o aluno ver na subaba ESTRUTURADO (semanas,
          treinos A-E, ABDOMINAL, Cardio e Dicas).
        </p>
      </div>

      {has ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md bg-secondary/30 border border-border">
            <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{current?.source_name ?? "planilha.xlsx"}</p>
              <p className="text-[11px] text-muted-foreground">
                {plan!.blocks.length} treino(s) · {plan!.weeks.length} semana(s)
                {plan!.abdomen.length > 0 ? " · ABDOMINAL" : ""}
                {plan!.cardio.length > 0 ? " · Cardio" : ""}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} title="Editar">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDelete} className="text-destructive" title="Remover">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {editing && (
            <TrainingEditor
              studentId={studentId}
              sourceName={current?.source_name ?? "treino.xlsx"}
              initial={plan!}
              onSaved={() => {
                setEditing(false);
                onChanged();
              }}
              onCancel={() => setEditing(false)}
            />
          )}

          <details className="rounded-md border border-border bg-background/40">
            <summary className="cursor-pointer px-3 py-2 text-xs tactical-heading tracking-widest text-primary">
              VISUALIZAR LEITURA
            </summary>
            <div className="p-3 space-y-4 text-sm">
              {plan!.blocks.map((b, i) => (
                <div key={i}>
                  <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground mb-1">
                    {b.name.toUpperCase()}{b.day ? ` · ${b.day}` : ""}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-border">
                      <thead>
                        <tr className="bg-secondary/40">
                          <th className="text-left px-2 py-1 border-b border-border">Exercício</th>
                          {plan!.weeks.map((w, k) => (
                            <th key={k} className="text-left px-2 py-1 border-b border-border whitespace-nowrap">{w}</th>
                          ))}
                          <th className="text-left px-2 py-1 border-b border-border">Obs.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.exercises.map((ex, j) => (
                          <tr key={j} className="border-b border-border/60">
                            <td className="px-2 py-1 font-medium">{ex.name}</td>
                            {ex.weeks.map((v, k) => (
                              <td key={k} className="px-2 py-1 whitespace-nowrap">{v}</td>
                            ))}
                            <td className="px-2 py-1 text-muted-foreground">{ex.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {plan!.abdomen.length > 0 && (
                <div>
                  <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground mb-1">ABDOMINAL</p>
                  <ul className="space-y-1">
                    {plan!.abdomen.map((ex, i) => (
                      <li key={i}>
                        <span className="font-medium">{ex.name}</span>
                        {ex.weeks.filter(Boolean).length > 0 ? ` · ${ex.weeks.filter(Boolean).join(" | ")}` : ""}
                        {ex.note ? ` · ${ex.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plan!.cardio.length > 0 && (
                <div>
                  <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground mb-1">CARDIO</p>
                  <ul className="space-y-1">
                    {plan!.cardio.map((ex, i) => (
                      <li key={i}>
                        <span className="font-medium">{ex.name}</span>
                        {ex.weeks.filter(Boolean).length > 0 ? ` · ${ex.weeks.filter(Boolean).join(" | ")}` : ""}
                        {ex.note ? ` · ${ex.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plan!.tips.length > 0 && (
                <div>
                  <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground mb-1">DICAS E CONSIDERAÇÕES</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {plan!.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma planilha enviada ainda.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full tactical-heading"
      >
        <Upload className="w-4 h-4 mr-2" />
        {busy ? "PROCESSANDO..." : has ? "SUBSTITUIR XLSX" : "ENVIAR XLSX"}
      </Button>
    </Card>
  );
}
