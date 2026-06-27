import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Trash2 } from "lucide-react";
import {
  parseTrainingXlsx,
  type StructuredPlan,
} from "@/lib/training-xlsx-parser";
import {
  saveStructuredTrainingPlan,
  deleteStructuredTrainingPlan,
} from "@/lib/squad.functions";

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
          treinos A-E, ABDOMÊN, Cardio e Dicas).
        </p>
      </div>

      {has ? (
        <div className="flex items-center gap-2 p-3 rounded-md bg-secondary/30 border border-border">
          <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{current?.source_name ?? "planilha.xlsx"}</p>
            <p className="text-[11px] text-muted-foreground">
              {plan!.blocks.length} treino(s) · {plan!.weeks.length} semana(s)
              {plan!.abdomen.length > 0 ? " · ABDOMÊN" : ""}
              {plan!.cardio.length > 0 ? " · Cardio" : ""}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={handleDelete} className="text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
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
