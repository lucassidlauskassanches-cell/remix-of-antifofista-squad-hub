import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  getStudentDetail,
  getStudentPlanPdfUrl,
  savePlanPdf,
  deletePlanPdf,
} from "@/lib/squad.functions";
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
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="treino" className="tactical-heading">
            TREINO
          </TabsTrigger>
          <TabsTrigger value="nutricao" className="tactical-heading">
            NUTRIÇÃO
          </TabsTrigger>
        </TabsList>
        <TabsContent value="treino" className="mt-4">
          <PdfUploader
            studentId={id}
            kind="training"
            currentName={data.trainingPlan?.pdf_name ?? null}
            hasFile={!!data.trainingPlan?.pdf_path}
            onChanged={() => refetch()}
          />
        </TabsContent>
        <TabsContent value="nutricao" className="mt-4">
          <PdfUploader
            studentId={id}
            kind="nutrition"
            currentName={data.nutritionPlan?.pdf_name ?? null}
            hasFile={!!data.nutritionPlan?.pdf_path}
            onChanged={() => refetch()}
          />
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
  kind: "training" | "nutrition";
  currentName: string | null;
  hasFile: boolean;
  onChanged: () => void;
}) {
  const save = useServerFn(savePlanPdf);
  const del = useServerFn(deletePlanPdf);
  const getUrl = useServerFn(getStudentPlanPdfUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const label = kind === "training" ? "TREINO" : "DIETA";

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
