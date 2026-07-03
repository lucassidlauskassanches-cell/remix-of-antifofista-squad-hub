import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getStudentDetail,
  getStudentStructuredTrainingPlan,
  getStudentDiet,
} from "@/lib/squad.functions";
import { saveStudentAnamnese, getStudentAdherence } from "@/lib/registro.functions";
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
          initial_weight_kg: (data.profile as any)?.initial_weight_kg ?? null,
          water_ml_per_kg: (data.profile as any)?.water_ml_per_kg ?? 50,
        }}
      />

      <Tabs defaultValue="treino">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="aderencia" className="tactical-heading">ADERÊNCIA</TabsTrigger>
          <TabsTrigger value="treino" className="tactical-heading">TREINO</TabsTrigger>
          <TabsTrigger value="nutricao" className="tactical-heading">NUTRIÇÃO</TabsTrigger>
          <TabsTrigger value="acao" className="tactical-heading">AÇÃO</TabsTrigger>
          <TabsTrigger value="logbook" className="tactical-heading">LOGBOOK</TabsTrigger>
        </TabsList>
        <TabsContent value="aderencia" className="mt-4">
          <AderenciaSection studentId={id} />
        </TabsContent>
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

function AnamneseCard({
  studentId,
  initial,
}: {
  studentId: string;
  initial: {
    initial_weight_kg: number | null;
    water_ml_per_kg: number;
  };
}) {
  const [form, setForm] = useState(initial);
  const saveFn = useServerFn(saveStudentAnamnese);
  const qc = useQueryClient();
  const mSave = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          studentId,
          initial_weight_kg: form.initial_weight_kg
            ? Number(form.initial_weight_kg)
            : null,
          water_ml_per_kg: Number(form.water_ml_per_kg) || 50,
        },
      }),
    onSuccess: () => {
      toast.success("Anamnese salva — meta de água atualizada pro aluno");
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      qc.invalidateQueries({ queryKey: ["student-adherence", studentId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const goalMl =
    Number(form.initial_weight_kg ?? 0) *
    (Number(form.water_ml_per_kg) || 50);

  return (
    <Card className="p-4 space-y-3">
      <h3 className="tactical-heading text-sm tracking-widest">ANAMNESE</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Peso inicial (kg)</Label>
          <Input
            type="number"
            step="0.1"
            value={form.initial_weight_kg ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                initial_weight_kg: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Água (ml por kg)</Label>
          <Input
            type="number"
            min={20}
            max={80}
            value={form.water_ml_per_kg ?? 50}
            onChange={(e) =>
              setForm({
                ...form,
                water_ml_per_kg: Number(e.target.value) || 50,
              })
            }
          />
        </div>
      </div>
      {goalMl > 0 && (
        <p className="text-xs text-muted-foreground">
          Meta diária de água do aluno:{" "}
          <span className="text-primary tactical-heading">
            {(goalMl / 1000).toFixed(2)} L
          </span>
        </p>
      )}
      <Button
        onClick={() => mSave.mutate()}
        disabled={mSave.isPending}
        size="sm"
      >
        SALVAR
      </Button>
    </Card>
  );
}


