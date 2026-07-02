import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getStudentDetail,
  getStudentStructuredTrainingPlan,
  getStudentDiet,
} from "@/lib/squad.functions";
import { saveStudentAnamnese } from "@/lib/registro.functions";
import { StructuredTrainingUploader } from "@/components/StructuredTrainingUploader";
import { DietUploader } from "@/components/DietUploader";
import { GerarPlanoAcao } from "@/components/GerarPlanoAcao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";


export const Route = createFileRoute("/_authenticated/app/admin/alunos/$id")({
  component: AlunoEditor,
});

function AlunoEditor() {
  const { id } = useParams({ from: "/_authenticated/app/admin/alunos/$id" });
  const getDetail = useServerFn(getStudentDetail);
  const { data } = useQuery({
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

      <AnamneseCard
        studentId={id}
        initial={{
          birth_date: (data.profile as any)?.birth_date ?? null,
          height_cm: (data.profile as any)?.height_cm ?? null,
          initial_weight_kg: (data.profile as any)?.initial_weight_kg ?? null,
          water_ml_per_kg: (data.profile as any)?.water_ml_per_kg ?? 50,
        }}
      />

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
