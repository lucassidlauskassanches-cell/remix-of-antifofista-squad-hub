import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  getStudentDetail,
  getStudentPlanPdfUrl,
  savePlanPdf,
  deletePlanPdf,
  getStudentStructuredTrainingPlan,
  getStudentDiet,
} from "@/lib/squad.functions";
import { StructuredTrainingUploader } from "@/components/StructuredTrainingUploader";
import { DietUploader } from "@/components/DietUploader";
import { GerarPlanoAcao } from "@/components/GerarPlanoAcao";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ArrowLeft, Upload, FileText, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin/alunos/$id")({
  component: AlunoEditor,
});

function AlunoEditor() {
  const { id } = useParams({ from: "/_authenticated/app/admin/alunos/$id" });
  const getDetail = useServerFn(getStudentDetail);
  const { data, refetch } = useQuery({
    queryKey: ["student", id],
    queryFn: () => getDetail({ data: { studentId: id } }),
  });

  if (!data) return <p>Carregando...</p>;

  return (
    <div className="space-y-4">
      <Link
        to="/app/admin/alunos"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Link>
      <div>
        <h1 className="tactical-heading text-2xl">{data.profile?.full_name}</h1>
        <p className="text-sm text-muted-foreground">{data.profile?.email}</p>
      </div>

      <Tabs defaultValue="treino">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="treino" className="tactical-heading">TREINO</TabsTrigger>
          <TabsTrigger value="nutricao" className="tactical-heading">NUTRIÇÃO</TabsTrigger>
          <TabsTrigger value="acao" className="tactical-heading">AÇÃO</TabsTrigger>
          <TabsTrigger value="logbook" className="tactical-heading">LOGBOOK</TabsTrigger>
        </TabsList>
        <TabsContent value="treino" className="mt-4 space-y-4">
          <StructuredPlanSection studentId={id} />
        </TabsContent>
        <TabsContent value="nutricao" className="mt-4 space-y-4">
          <DietSection studentId={id} />
        </TabsContent>
        <TabsContent value="acao" className="mt-4">
          <GerarPlanoAcao studentId={id} alunoNome={data.profile?.full_name ?? ""} />
        </TabsContent>
        <TabsContent value="logbook" className="mt-4">
          <LogbookReadOnly rows={(data as any).logbook ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PdfUploader({
  studentId,
  kind,
  currentName,
  hasFile,
  onChanged,
}: {
  studentId: string;
  kind: "training" | "nutrition" | "action";
  currentName: string | null;
  hasFile: boolean;
  onChanged: () => void;
}) {
  const save = useServerFn(savePlanPdf);
  const del = useServerFn(deletePlanPdf);
  const getUrl = useServerFn(getStudentPlanPdfUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const label = kind === "training" ? "TREINO" : kind === "nutrition" ? "DIETA" : "PLANO DE AÇÃO";

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 20MB).");
      return;
    }
    setUploading(true);
    try {
      const path = `${studentId}/${kind}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("plans")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      await save({
        data: {
          studentId,
          kind,
          pdf_path: path,
          pdf_name: file.name,
        },
      });
      toast.success(`${label} enviado`);
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao enviar");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openPdf() {
    try {
      const res = await getUrl({ data: { studentId, kind } });
      if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else toast.error("Arquivo indisponível");
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    }
  }

  async function handleDelete() {
    if (!confirm("Remover este PDF?")) return;
    try {
      await del({ data: { studentId, kind } });
      toast.success("Removido");
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          PDF DE {label}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Envie o PDF que o aluno irá visualizar no app.
        </p>
      </div>

      {hasFile ? (
        <div className="flex items-center gap-2 p-3 rounded-md bg-secondary/30 border border-border">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm flex-1 truncate">{currentName ?? "documento.pdf"}</span>
          <Button size="sm" variant="outline" onClick={openPdf}>
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum PDF enviado ainda.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full tactical-heading bg-primary text-primary-foreground"
      >
        <Upload className="w-4 h-4 mr-2" />
        {uploading ? "ENVIANDO..." : hasFile ? "SUBSTITUIR PDF" : "ENVIAR PDF"}
      </Button>
    </Card>
  );
}

function LogbookReadOnly({
  rows,
}: {
  rows: Array<{
    id: string;
    exercise: string;
    load: string;
    reps: string;
    entry_date?: string;
    order_index?: number;
  }>;
}) {
  const sorted = [...rows].sort((a, b) => {
    const byName = a.exercise.localeCompare(b.exercise, "pt-BR", { sensitivity: "base" });
    if (byName !== 0) return byName;
    return (a.entry_date || "").localeCompare(b.entry_date || "");
  });
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[0.9fr_1.3fr_0.8fr_0.8fr] gap-2 px-3 py-2 bg-secondary/40 border-b border-border">
        <span className="tactical-heading text-[10px] tracking-widest text-primary">DATA</span>
        <span className="tactical-heading text-[10px] tracking-widest text-primary">EXERCÍCIO</span>
        <span className="tactical-heading text-[10px] tracking-widest text-primary">CARGA</span>
        <span className="tactical-heading text-[10px] tracking-widest text-primary">REPS</span>
      </div>
      {sorted.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          O aluno ainda não registrou nenhuma linha.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {sorted.map((r) => (
            <li key={r.id} className="grid grid-cols-[0.9fr_1.3fr_0.8fr_0.8fr] gap-2 px-3 py-2 text-sm">
              <span className="truncate">{formatDate(r.entry_date)}</span>
              <span className="truncate">{r.exercise || "—"}</span>
              <span className="truncate">{r.load || "—"}</span>
              <span className="truncate">{r.reps || "—"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
        Apenas leitura. O aluno é quem edita o logbook.
      </p>
    </Card>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function StructuredPlanSection({ studentId }: { studentId: string }) {
  const fetchPlan = useServerFn(getStudentStructuredTrainingPlan);
  const { data, refetch } = useQuery({
    queryKey: ["student-structured-training", studentId],
    queryFn: () => fetchPlan({ data: { studentId } }),
  });
  return (
    <StructuredTrainingUploader
      studentId={studentId}
      current={(data as any) ?? null}
      onChanged={() => refetch()}
    />
  );
}

function DietSection({ studentId }: { studentId: string }) {
  const fetchDiet = useServerFn(getStudentDiet);
  const { data, refetch } = useQuery({
    queryKey: ["student-diet", studentId],
    queryFn: () => fetchDiet({ data: { studentId } }),
  });
  return (
    <DietUploader
      studentId={studentId}
      current={(data as any) ?? null}
      onChanged={() => refetch()}
    />
  );
}
