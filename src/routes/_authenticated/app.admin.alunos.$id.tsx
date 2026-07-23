import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getStudentDetail,
  getStudentStructuredTrainingPlan,
  getStudentDiet,
  updateStudentProfile,
  assignStudentTrainer,
} from "@/lib/squad.functions";
import { saveStudentAnamnese, getStudentAdherence } from "@/lib/registro.functions";
import { getMyContext, listTrainersForStudentForm } from "@/lib/access.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

      <DadosCard
        studentId={id}
        initial={{
          full_name: data.profile?.full_name ?? "",
          email: data.profile?.email ?? "",
          phone: (data.profile as any)?.phone ?? "",
        }}
      />

      <TrainerAssignCard
        studentId={id}
        currentTrainerId={(data.profile as any)?.trainer_id ?? null}
      />

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

function DadosCard({
  studentId,
  initial,
}: {
  studentId: string;
  initial: { full_name: string; email: string; phone: string };
}) {
  const [form, setForm] = useState(initial);
  const saveFn = useServerFn(updateStudentProfile);
  const qc = useQueryClient();
  const mSave = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          studentId,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Dados do aluno atualizados");
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Card className="p-4 space-y-3">
      <h3 className="tactical-heading text-sm tracking-widest">DADOS DO ALUNO</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nome completo</Label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">E-mail</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Telefone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </div>
      <Button
        onClick={() => mSave.mutate()}
        disabled={mSave.isPending || !form.full_name.trim() || !form.email.trim()}
        size="sm"
      >
        SALVAR DADOS
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

// ---------------- Aderência (read-only snapshot da aba antifofista) ----------------
function AderenciaSection({ studentId }: { studentId: string }) {
  const fetchAdh = useServerFn(getStudentAdherence);
  const { data, isLoading } = useQuery({
    queryKey: ["student-adherence", studentId],
    queryFn: () => fetchAdh({ data: { studentId } }),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Carregando aderência...</p>;
  }

  const goalL = data.waterGoalMl ? (data.waterGoalMl / 1000).toFixed(2) : "—";
  const today = data.today;
  const avg = data.averages;

  return (
    <div className="space-y-4">
      {/* Snapshot de hoje */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="tactical-heading text-sm tracking-widest">HOJE</h3>
          <span className="text-[10px] text-muted-foreground tracking-widest">
            META ÁGUA {goalL} L · {data.waterMlPerKg} ml/kg
          </span>
        </div>
        {today ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="SCORE"
              value={`${Math.round(today.score)}%`}
              color={colorForPct(today.score / 100)}
            />
            <Stat
              label="ÁGUA"
              value={`${(today.water_ml / 1000).toFixed(2)}L`}
              hint={`${Math.round(today.water_pct * 100)}% da meta`}
              color={colorForPct(today.water_pct)}
            />
            <Stat
              label="TREINO"
              value={today.rest_day ? "DESCANSO" : today.trained ? "✓ FEITO" : "PENDENTE"}
              color={
                today.rest_day
                  ? "hsl(var(--muted-foreground))"
                  : today.trained
                    ? "hsl(var(--primary))"
                    : "hsl(var(--destructive))"
              }
            />
            <Stat
              label="REFEIÇÕES"
              value={`${today.meals_done}/${today.meals_total || data.dietMealCount || 0}`}
              hint={
                today.meal_avg_rating > 0
                  ? `⭐ ${today.meal_avg_rating.toFixed(1)}`
                  : undefined
              }
              color={colorForPct(
                today.meals_total
                  ? today.meals_done / today.meals_total
                  : 0,
              )}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ainda não há registro do aluno hoje.
          </p>
        )}
      </Card>

      {/* Médias 30 dias */}
      <Card className="p-4 space-y-3">
        <h3 className="tactical-heading text-sm tracking-widest">
          ÚLTIMOS 30 DIAS
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat
            label="SCORE MÉDIO"
            value={`${Math.round(avg.score)}%`}
            color={colorForPct(avg.score / 100)}
          />
          <Stat
            label="ÁGUA"
            value={`${Math.round(avg.waterPct * 100)}%`}
            hint="da meta"
            color={colorForPct(avg.waterPct)}
          />
          <Stat
            label="TREINO"
            value={`${Math.round(avg.trainingPct * 100)}%`}
            hint="dos dias úteis"
            color={colorForPct(avg.trainingPct)}
          />
          <Stat
            label="DIETA"
            value={`${Math.round(avg.mealAdherence * 100)}%`}
            hint={avg.mealRating > 0 ? `⭐ ${avg.mealRating.toFixed(1)}` : undefined}
            color={colorForPct(avg.mealAdherence)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
          <Stat
            label="STREAK ATUAL"
            value={`${data.streak.current}d`}
            color="hsl(var(--primary))"
          />
          <Stat
            label="RECORDE"
            value={`${data.streak.longest}d`}
            color="hsl(var(--muted-foreground))"
          />
          <Stat
            label="TOTAL COMPLETOS"
            value={`${data.streak.total}d`}
            color="hsl(var(--muted-foreground))"
          />
        </div>
      </Card>

      {/* Barras diárias */}
      <Card className="p-4 space-y-3">
        <h3 className="tactical-heading text-sm tracking-widest">
          SCORE DIÁRIO
        </h3>
        {data.days.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem registros no período.</p>
        ) : (
          <div className="space-y-1">
            <div className="flex items-end gap-[3px] h-32">
              {data.days.map((d) => (
                <div
                  key={d.date}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${Math.max(2, d.score)}%`,
                    background: colorForPct(d.score / 100),
                    opacity: d.rest_day ? 0.55 : 1,
                  }}
                  title={`${d.date} — ${Math.round(d.score)}%${d.rest_day ? " (descanso)" : ""}`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{data.days[0]?.date}</span>
              <span>{data.days[data.days.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Tabela detalhada */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[0.9fr_0.6fr_0.9fr_0.7fr_0.7fr] gap-2 px-3 py-2 bg-secondary/40 border-b border-border">
          <span className="tactical-heading text-[10px] tracking-widest text-primary">DATA</span>
          <span className="tactical-heading text-[10px] tracking-widest text-primary">SCORE</span>
          <span className="tactical-heading text-[10px] tracking-widest text-primary">ÁGUA</span>
          <span className="tactical-heading text-[10px] tracking-widest text-primary">TREINO</span>
          <span className="tactical-heading text-[10px] tracking-widest text-primary">REFEIÇÕES</span>
        </div>
        {data.days.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sem registros ainda.</p>
        ) : (
          <ul className="divide-y divide-border max-h-80 overflow-auto">
            {[...data.days].reverse().map((d) => (
              <li
                key={d.date}
                className="grid grid-cols-[0.9fr_0.6fr_0.9fr_0.7fr_0.7fr] gap-2 px-3 py-2 text-xs items-center"
              >
                <span>{formatDate(d.date)}</span>
                <span
                  className="tactical-heading"
                  style={{ color: colorForPct(d.score / 100) }}
                >
                  {Math.round(d.score)}%
                </span>
                <span>
                  {(d.water_ml / 1000).toFixed(2)}L
                  <span className="text-muted-foreground">
                    {" · "}
                    {Math.round(d.water_pct * 100)}%
                  </span>
                </span>
                <span>
                  {d.rest_day ? "😴" : d.trained ? "✓" : "—"}
                </span>
                <span>
                  {d.meals_total > 0
                    ? `${d.meals_done}/${d.meals_total}`
                    : "—"}
                  {d.meal_avg_rating > 0 && (
                    <span className="text-muted-foreground">
                      {" ⭐"}
                      {d.meal_avg_rating.toFixed(1)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className="tactical-heading text-xl leading-none"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function colorForPct(pct: number): string {
  if (pct >= 0.8) return "hsl(var(--primary))";
  if (pct >= 0.5) return "hsl(45 90% 55%)";
  return "hsl(var(--destructive))";
}




function TrainerAssignCard({
  studentId,
  currentTrainerId,
}: {
  studentId: string;
  currentTrainerId: string | null;
}) {
  const fetchCtx = useServerFn(getMyContext);
  const { data: ctx } = useQuery({
    queryKey: ["my-context"],
    queryFn: () => fetchCtx(),
  });
  const fetchTrainers = useServerFn(listTrainersForStudentForm);
  const { data: trainersData } = useQuery({
    queryKey: ["trainers"],
    queryFn: () => fetchTrainers(),
    enabled: !!ctx?.isAdmin,
  });
  const assignFn = useServerFn(assignStudentTrainer);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>(currentTrainerId ?? "__none__");

  const mAssign = useMutation({
    mutationFn: () =>
      assignFn({
        data: {
          studentId,
          trainerId: selected === "__none__" ? null : selected,
        },
      }),
    onSuccess: () => {
      toast.success("Treinador do aluno atualizado");
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atribuir treinador"),
  });

  if (!ctx?.isAdmin) return null;

  const dirty = (selected === "__none__" ? null : selected) !== currentTrainerId;

  return (
    <Card className="p-4 space-y-3">
      <h3 className="tactical-heading text-sm tracking-widest">TREINADOR RESPONSÁVEL</h3>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <Label className="text-xs">Treinador</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um treinador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem treinador</SelectItem>
              {(trainersData?.rows ?? []).map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.full_name || t.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => mAssign.mutate()}
          disabled={mAssign.isPending || !dirty}
          size="sm"
        >
          ATRIBUIR
        </Button>
      </div>
    </Card>
  );
}
