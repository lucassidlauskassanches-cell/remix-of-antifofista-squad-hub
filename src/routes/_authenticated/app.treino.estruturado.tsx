import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { getMyStructuredTrainingPlan } from "@/lib/squad.functions";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { describeCell, type StructuredPlan, type StructuredExercise } from "@/lib/training-xlsx-parser";

export const Route = createFileRoute("/_authenticated/app/treino/estruturado")({
  component: EstruturadoPage,
});

function EstruturadoPage() {
  const fetchPlan = useServerFn(getMyStructuredTrainingPlan);
  const { data, isLoading } = useQuery({
    queryKey: ["my-structured-training"],
    queryFn: () => fetchPlan(),
  });

  const plan = (data?.plan ?? null) as StructuredPlan | null;
  const [weekIdx, setWeekIdx] = useState(0);
  const [blockIdx, setBlockIdx] = useState(0);

  useEffect(() => {
    setWeekIdx(0);
    setBlockIdx(0);
  }, [data?.updated_at]);

  if (isLoading) {
    return <p className="text-center py-16 text-muted-foreground">Carregando...</p>;
  }
  if (!plan || !plan.weeks?.length || !plan.blocks?.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Seu treinador ainda não enviou a planilha estruturada.
      </div>
    );
  }

  const block = plan.blocks[blockIdx];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <LabeledSelect
          label="SEMANA"
          value={String(weekIdx)}
          options={plan.weeks.map((w, i) => ({ value: String(i), label: w }))}
          onChange={(v) => setWeekIdx(Number(v))}
        />
        <LabeledSelect
          label="TREINO"
          value={String(blockIdx)}
          options={plan.blocks.map((b, i) => ({
            value: String(i),
            label: b.day ? `${b.name} — ${b.day}` : b.name,
          }))}
          onChange={(v) => setBlockIdx(Number(v))}
        />
      </div>

      <section className="space-y-2">
        <h2 className="tactical-heading text-sm text-primary tracking-widest">
          {block.day ? `${block.name} — ${block.day}` : block.name}
        </h2>
        <ExerciseList exercises={block.exercises} weekIdx={weekIdx} />
      </section>

      {plan.abdomen?.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="tactical-heading text-sm text-primary tracking-widest">ABDOMÊN</h2>
          <ExerciseList exercises={plan.abdomen} weekIdx={weekIdx} />
        </section>
      )}

      {plan.cardio?.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="tactical-heading text-sm text-primary tracking-widest">CARDIO</h2>
          <ExerciseList exercises={plan.cardio} weekIdx={weekIdx} />
        </section>
      )}

      {plan.tips?.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="tactical-heading text-sm text-primary tracking-widest">
            DICAS E CONSIDERAÇÕES
          </h2>
          <Card className="p-4 space-y-2">
            {plan.tips.map((t, i) => (
              <p key={i} className="text-sm leading-relaxed">
                {t}
              </p>
            ))}
          </Card>
        </section>
      )}

      {data?.source_name && (
        <p className="text-[10px] text-muted-foreground text-center pt-4">
          Origem: {data.source_name}
        </p>
      )}
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="tactical-heading text-[10px] tracking-widest text-muted-foreground">
        {label}
      </p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ExerciseList({
  exercises,
  weekIdx,
}: {
  exercises: StructuredExercise[];
  weekIdx: number;
}) {
  const items = useMemo(
    () => exercises.filter((e) => e.name || (e.weeks?.[weekIdx] ?? "").trim()),
    [exercises, weekIdx],
  );
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Sem exercícios nesta seção.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((ex, i) => {
        const raw = ex.weeks?.[weekIdx] ?? "";
        const parsed = describeCell(raw);
        return (
          <Card key={i} className="p-3 space-y-1">
            <p className="font-medium leading-tight">{ex.name || "—"}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {parsed.sets && parsed.reps ? (
                <span>
                  <strong>{parsed.sets}</strong> séries ·{" "}
                  <strong>{parsed.reps}</strong> reps
                </span>
              ) : raw ? (
                <span>{raw}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
              {parsed.technique && (
                <span className="inline-flex items-center rounded bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] tracking-widest tactical-heading">
                  {parsed.technique}
                </span>
              )}
              {parsed.sets && parsed.reps && raw !== `${parsed.sets}x${parsed.reps.replace(" a ", "a")}` && (
                <span className="text-[10px] text-muted-foreground">({raw})</span>
              )}
            </div>
            {ex.note && (
              <p className="text-xs text-amber-400/90 border-l-2 border-amber-400/60 pl-2 mt-1">
                {ex.note}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
