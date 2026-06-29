import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import {
  getMyStructuredTrainingPlan,
  listGallery,
  getMyLogbook,
  saveLogbookEntry,
} from "@/lib/squad.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { YouTubePlayer } from "@/lib/youtube";
import { Play, Check } from "lucide-react";
import { toast } from "sonner";
import { describeCell, type StructuredPlan, type StructuredExercise } from "@/lib/training-xlsx-parser";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

type LastEntry = { load: string; reps: string; date: string };
type SaveCarga = (v: { id?: string; exercise: string; load: string; reps: string }) => void;

export const Route = createFileRoute("/_authenticated/app/treino/")({
  component: EstruturadoPage,
});

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function EstruturadoPage() {
  const fetchPlan = useServerFn(getMyStructuredTrainingPlan);
  const fetchGallery = useServerFn(listGallery);
  const { data, isLoading } = useQuery({
    queryKey: ["my-structured-training"],
    queryFn: () => fetchPlan(),
  });
  const { data: galleryData } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => fetchGallery(),
  });

  const fetchLog = useServerFn(getMyLogbook);
  const { data: logData } = useQuery({
    queryKey: ["my-logbook"],
    queryFn: () => fetchLog(),
  });

  const queryClient = useQueryClient();
  const save = useServerFn(saveLogbookEntry);
  const saveMutation = useMutation({
    mutationFn: (v: { id?: string; exercise: string; load: string; reps: string }) =>
      save({
        data: {
          id: v.id,
          exercise: v.exercise,
          load: v.load,
          reps: v.reps,
          entry_date: todayStr(),
          order_index: 0,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-logbook"] });
      toast.success("Carga registrada");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao registrar"),
  });
  const saveCarga: SaveCarga = (v) => saveMutation.mutate(v);

  const today = todayStr();
  const lastByExercise = useMemo(() => {
    const m = new Map<string, LastEntry>();
    ((logData?.rows ?? []) as any[]).forEach((r) => {
      const key = normalize(r.exercise);
      if (!key) return;
      const prev = m.get(key);
      if (!prev || (r.entry_date || "") >= prev.date)
        m.set(key, { load: r.load || "", reps: r.reps || "", date: r.entry_date || "" });
    });
    return m;
  }, [logData]);

  const todayIdByExercise = useMemo(() => {
    const m = new Map<string, string>();
    ((logData?.rows ?? []) as any[]).forEach((r) => {
      if ((r.entry_date || "") === today) m.set(normalize(r.exercise), r.id);
    });
    return m;
  }, [logData, today]);

  const galleryMap = useMemo(() => {
    const m = new Map<string, { title: string; url: string }>();
    (galleryData?.items ?? []).forEach((it: any) => {
      const key = normalize(it.title);
      if (key && !m.has(key)) m.set(key, { title: it.title, url: it.youtube_url });
    });
    return m;
  }, [galleryData]);

  const plan = (data?.plan ?? null) as StructuredPlan | null;
  const [weekIdx, setWeekIdx] = useState(0);
  const [blockIdx, setBlockIdx] = useState(0);
  const [video, setVideo] = useState<{ url: string; title: string } | null>(null);
  const [restored, setRestored] = useState(false);

  // Lembra o último treino/semana que o aluno abriu (por aparelho), pra não
  // resetar pra semana 1 toda vez que ele volta.
  useEffect(() => {
    const w = Number(localStorage.getItem("treino:weekIdx"));
    const b = Number(localStorage.getItem("treino:blockIdx"));
    if (Number.isFinite(w) && w >= 0) setWeekIdx(w);
    if (Number.isFinite(b) && b >= 0) setBlockIdx(b);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    localStorage.setItem("treino:weekIdx", String(weekIdx));
    localStorage.setItem("treino:blockIdx", String(blockIdx));
  }, [weekIdx, blockIdx, restored]);

  // Se a planilha mudou e tem menos semanas/treinos, mantém dentro do limite.
  useEffect(() => {
    if (!plan) return;
    setWeekIdx((i) => Math.min(Math.max(i, 0), plan.weeks.length - 1));
    setBlockIdx((i) => Math.min(Math.max(i, 0), plan.blocks.length - 1));
  }, [plan?.weeks?.length, plan?.blocks?.length]);

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

  const safeBlockIdx = Math.min(Math.max(blockIdx, 0), plan.blocks.length - 1);
  const safeWeekIdx = Math.min(Math.max(weekIdx, 0), plan.weeks.length - 1);
  const block = plan.blocks[safeBlockIdx];

  function lookup(name: string) {
    return galleryMap.get(normalize(name)) ?? null;
  }

  const cargaProps = {
    lastByExercise,
    todayIdByExercise,
    onSaveCarga: saveCarga,
    savingCarga: saveMutation.isPending,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <LabeledSelect
          label="SEMANA"
          value={String(safeWeekIdx)}
          options={plan.weeks.map((w, i) => ({ value: String(i), label: w }))}
          onChange={(v) => setWeekIdx(Number(v))}
        />
        <LabeledSelect
          label="TREINO"
          value={String(safeBlockIdx)}
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
        <ExerciseList exercises={block.exercises} weekIdx={safeWeekIdx} lookup={lookup} onPlay={setVideo} {...cargaProps} />
      </section>

      {plan.abdomen?.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="tactical-heading text-sm text-primary tracking-widest">ABDOMÊN</h2>
          <ExerciseList exercises={plan.abdomen} weekIdx={safeWeekIdx} lookup={lookup} onPlay={setVideo} />
        </section>
      )}

      {plan.cardio?.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="tactical-heading text-sm text-primary tracking-widest">CARDIO</h2>
          <ExerciseList exercises={plan.cardio} weekIdx={safeWeekIdx} lookup={lookup} onPlay={setVideo} />
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

      <Dialog open={!!video} onOpenChange={(o) => !o && setVideo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="tactical-heading">{video?.title}</DialogTitle>
          </DialogHeader>
          {video && <YouTubePlayer url={video.url} />}
        </DialogContent>
      </Dialog>
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
  lookup,
  onPlay,
  lastByExercise,
  todayIdByExercise,
  onSaveCarga,
  savingCarga,
}: {
  exercises: StructuredExercise[];
  weekIdx: number;
  lookup: (name: string) => { title: string; url: string } | null;
  onPlay: (v: { title: string; url: string }) => void;
  lastByExercise?: Map<string, LastEntry>;
  todayIdByExercise?: Map<string, string>;
  onSaveCarga?: SaveCarga;
  savingCarga?: boolean;
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
        const video = ex.name ? lookup(ex.name) : null;
        const key = normalize(ex.name || "");
        const last = lastByExercise?.get(key) ?? null;
        const todayId = todayIdByExercise?.get(key);
        return (
          <Card key={i} className="p-3 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-tight">{ex.name || "—"}</p>
              {video && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onPlay(video)}
                  className="shrink-0 h-8 tactical-heading text-[10px] tracking-widest"
                >
                  <Play className="w-3.5 h-3.5 mr-1" /> VÍDEO
                </Button>
              )}
            </div>
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
              <p className="text-xs text-muted-foreground border-l-2 border-primary/50 pl-2 mt-1">
                {ex.note}
              </p>
            )}
            {onSaveCarga && ex.name && (
              <RegistrarCarga
                exercise={ex.name}
                last={last}
                todayId={todayId}
                prescribedReps={parsed.reps ?? ""}
                onSave={onSaveCarga}
                saving={!!savingCarga}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}

function formatBR(date: string) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}`;
}

function RegistrarCarga({
  exercise,
  last,
  todayId,
  prescribedReps,
  onSave,
  saving,
}: {
  exercise: string;
  last: LastEntry | null;
  todayId?: string;
  prescribedReps: string;
  onSave: SaveCarga;
  saving: boolean;
}) {
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("");

  // Pré-preenche com a última carga registrada (ou as reps prescritas) só uma
  // vez, quando o histórico carrega — depois respeita o que o aluno digitar.
  useEffect(() => {
    setLoad(last?.load ?? "");
    setReps(last?.reps || prescribedReps);
  }, [last?.date]);

  const done = !!todayId;

  return (
    <div className="mt-2 rounded-md border border-border bg-secondary/30 p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="tactical-heading text-[10px] tracking-widest text-muted-foreground">
          {done ? "REGISTRADO HOJE" : "REGISTRAR CARGA"}
        </span>
        {last?.date && (
          <span className="text-[10px] text-muted-foreground">
            última: {last.load || "—"}
            {last.reps ? ` · ${last.reps} reps` : ""} ({formatBR(last.date)})
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={load}
          onChange={(e) => setLoad(e.target.value)}
          placeholder="carga"
          className="w-0 flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
        <input
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="reps"
          className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => onSave({ id: todayId, exercise, load: load.trim(), reps: reps.trim() })}
          disabled={saving || !load.trim()}
          className="h-8 shrink-0 bg-primary text-primary-foreground"
          aria-label="Salvar carga"
        >
          <Check className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
