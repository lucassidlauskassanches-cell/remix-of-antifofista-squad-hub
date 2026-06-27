import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Trash2, Pencil } from "lucide-react";
import { parseDietXlsx, type DietPlan } from "@/lib/diet-xlsx-parser";
import { saveDiet, deleteDiet } from "@/lib/squad.functions";
import { DietEditor } from "@/components/DietEditor";

export function DietUploader({
  studentId,
  current,
  onChanged,
}: {
  studentId: string;
  current: {
    source_name?: string | null;
    data?: DietPlan | null;
    updated_at?: string;
  } | null;
  onChanged: () => void;
}) {
  const save = useServerFn(saveDiet);
  const del = useServerFn(deleteDiet);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DietPlan | null>(null);
  const [editing, setEditing] = useState(false);

  function isVisibleMealItem(item: { alimento?: string }) {
    const alimento = item.alimento?.trim() ?? "";
    const normalized = alimento
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    return /[a-z]/.test(normalized) && !["observacoes", "observacao", "obs", "alimento", "qtd", "quantidade", "medida"].includes(normalized);
  }

  function cleanPlan(plan: DietPlan | null): DietPlan | null {
    if (!plan) return null;
    return {
      suplementos: (plan.suplementos ?? []).filter((s) => s.nome?.trim()),
      refeicoes: (plan.refeicoes ?? [])
        .map((meal) => ({
          ...meal,
          nome: meal.nome?.trim() || "Refeição",
          itens: (meal.itens ?? []).filter(isVisibleMealItem),
        }))
        .filter((meal) => meal.itens.length > 0),
      observacoes: plan.observacoes ?? "",
    };
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const plan = cleanPlan(await parseDietXlsx(file))!;
      if (!plan.suplementos.length && !plan.refeicoes.length) {
        throw new Error(
          "Nada foi encontrado na aba IMPRESSÃO (nem suplementos nem refeições).",
        );
      }
      await save({ data: { studentId, sourceName: file.name, plan } });
      setPreview(plan);
      toast.success(
        `Dieta lida: ${plan.suplementos.length} suplemento(s), ${plan.refeicoes.length} refeição(ões).`,
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
    if (!confirm("Remover a dieta estruturada?")) return;
    try {
      await del({ data: { studentId } });
      setPreview(null);
      toast.success("Removido");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  }

  const plan = cleanPlan((preview ?? (current?.data as DietPlan | undefined)) ?? null);
  const has =
    !!plan && (plan.suplementos.length > 0 || plan.refeicoes.length > 0);

  return (
    <Card className="p-4 space-y-3">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          DIETA ESTRUTURADA (XLSX)
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Envie o Excel da dieta. O app lê apenas a aba <strong>IMPRESSÃO</strong> e
          monta automaticamente a subaba DIETA do aluno.
        </p>
      </div>

      {has ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md bg-secondary/30 border border-border">
            <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">
                {current?.source_name ?? "dieta.xlsx"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {plan!.suplementos.length} suplemento(s) ·{" "}
                {plan!.refeicoes.length} refeição(ões)
                {plan!.observacoes ? " · observações" : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              className="text-destructive"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {editing && (
            <DietEditor
              studentId={studentId}
              sourceName={current?.source_name ?? "dieta.xlsx"}
              initial={plan!}
              onSaved={() => {
                setEditing(false);
                setPreview(null);
                onChanged();
              }}
              onCancel={() => setEditing(false)}
            />
          )}

          <details className="rounded-md border border-border bg-background/40">
            <summary className="cursor-pointer px-3 py-2 text-xs tactical-heading tracking-widest text-primary">
              VISUALIZAR LEITURA
            </summary>
            <div className="p-3 space-y-3 text-sm">
              {plan!.suplementos.length > 0 && (
                <div>
                  <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground mb-1">
                    SUPLEMENTAÇÃO E MANIPULADOS
                  </p>
                  <ul className="space-y-1">
                    {plan!.suplementos.map((s, i) => (
                      <li key={i}>
                        <span className="font-medium">{s.nome}</span>
                        {s.dose ? ` · ${s.dose}` : ""}
                        {s.horario ? ` · ${s.horario}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan!.refeicoes.map((m, i) => (
                <div key={i}>
                  <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground mb-1">
                    {m.nome.toUpperCase()}
                  </p>
                  <ul className="space-y-1">
                    {m.itens.map((it, j) => (
                      <li key={j}>
                        {it.alimento}
                        {it.quantidade ? ` · ${it.quantidade}` : ""}
                        {it.medida ? ` ${it.medida}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {plan!.observacoes && (
                <div>
                  <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground mb-1">
                    OBSERVAÇÕES
                  </p>
                  <p>{plan!.observacoes}</p>
                </div>
              )}
            </div>
          </details>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma dieta enviada ainda.
        </p>
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
