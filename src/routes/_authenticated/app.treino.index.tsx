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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { YouTubePlayer } from "@/lib/youtube";
import { Play, Check, Table2, LayoutList, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  describeCell,
  type StructuredPlan,
  type StructuredExercise,
  type StructuredBlock,
} from "@/lib/training-xlsx-parser";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

type LastEntry = { load: string; reps: string; date: string };
type SaveCarga = (v: {
  id?: string;
  exercise: string;
  load: string;
  reps: string;
}) => void;

export const Route = createFileRoute("/_authenticated/app/treino/")({
  component: EstruturadoPage,
});

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function shortWeek(label: string, i: number) {
  const m = (label || "").match(/(\d+)/);
  return m ? `S${m[1]}` : label?.trim() || `S${i + 1}`;
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
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const saveMutation = useMutation({
    mutationFn: (v: {
      id?: string;
      exercise: string;
      load: string;
      reps: string;
    }) =>
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
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["my-logbook"] });
      toast.success("Carga registrada");
      setActiveKey((cur) => (cur === normalize(v.exercise) ? null : cur));
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
        m.set(key, {
          load: r.load || "",
          reps: r.reps || "",
          date: r.entry_date || "",
        });
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
  const [planilha, setPlanilha] = useState(false);
  const [restored, setRestored] = useState(false);

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

  useEffect(() => {
    if (!plan) return;
    setWeekIdx((i) => Math.min(Math.max(i, 0), plan.weeks.length - 1));
    setBlockIdx((i) => Math.min(Math.max(i, 0), plan.blocks.length - 1));
  }, [plan?.weeks?.length, plan?.blocks?.length]);

  // Trocar de bloco/semana fecha qualquer exercício em edição.
  useEffect(() => {
    setActiveKey(null);
  }, [blockIdx, weekIdx]);

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
    activeKey,
    onActivate: (key: string | null) => setActiveKey(key),
  };

  return (
    <div>
      <button type="button" className="af-planilha" onClick={() => setPlanilha((v) => !v)}>
        {planilha ? <LayoutList className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
        {planilha ? "Ver treino em cards" : "Ver treino em planilha"}
      </button>

      {plan.blocks.length > 1 && (
        <div className="af-week">
          {plan.blocks.map((b, i) => (
            <button
              key={i}
              type="button"
              className={`af-wk${i === safeBlockIdx ? " on" : ""}`}
              onClick={() => setBlockIdx(i)}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="af-week">
        {plan.weeks.map((w, i) => (
          <button
            key={i}
            type="button"
            className={`af-wk${i === safeWeekIdx ? " on" : ""}`}
            onClick={() => setWeekIdx(i)}
          >
            {shortWeek(w, i)}
          </button>
        ))}
      </div>

      {planilha ? (
        <PlanilhaTable block={block} weeks={plan.weeks} />
      ) : (
        <>
          <div className="af-sec">
            <span>{block.day ? `${block.name} — ${block.day}` : block.name}</span>
            <div className="ln" />
          </div>
          <ExerciseList
            exercises={block.exercises}
            weekIdx={safeWeekIdx}
            lookup={lookup}
            onPlay={setVideo}
            {...cargaProps}
          />

          {plan.abdomen?.length > 0 && (
            <>
              <div className="af-sec">
                <span>Abdômen</span>
                <div className="ln" />
              </div>
              <ExerciseList
                exercises={plan.abdomen}
                weekIdx={safeWeekIdx}
                lookup={lookup}
                onPlay={setVideo}
              />
            </>
          )}

          {plan.cardio?.length > 0 && (
            <>
              <div className="af-sec">
                <span>Cardio</span>
                <div className="ln" />
              </div>
              <ExerciseList
                exercises={plan.cardio}
                weekIdx={safeWeekIdx}
                lookup={lookup}
                onPlay={setVideo}
              />
            </>
          )}

          {plan.tips?.length > 0 && (
            <>
              <div className="af-sec">
                <span>Dicas e considerações</span>
                <div className="ln" />
              </div>
              <div className="af-ex space-y-2">
                {plan.tips.map((t, i) => (
                  <p key={i} className="text-sm leading-relaxed">
                    {t}
                  </p>
                ))}
              </div>
            </>
          )}
        </>
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

function PlanilhaTable({ block, weeks }: { block: StructuredBlock; weeks: string[] }) {
  const exercises: StructuredExercise[] = block.exercises ?? [];
  return (
    <div className="af-ex p-0 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 tactical-heading text-[10px] tracking-widest text-muted-foreground">
              Exercício
            </th>
            {weeks.map((w, i) => (
              <th
                key={i}
                className="px-3 py-2 tactical-heading text-[10px] tracking-widest text-muted-foreground whitespace-nowrap"
              >
                {shortWeek(w, i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exercises.map((ex, r) => (
            <tr key={r} className="border-t border-border">
              <td className="px-3 py-2 align-top">{ex.name || "—"}</td>
              {weeks.map((_, c) => (
                <td
                  key={c}
                  className="px-3 py-2 text-center text-xs text-muted-foreground whitespace-nowrap tabular-nums"
                >
                  {(ex.weeks?.[c] ?? "").trim() || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ListProps = {
  exercises: StructuredExercise[];
  weekIdx: number;
  lookup: (name: string) => { title: string; url: string } | null;
  onPlay: (v: { title: string; url: string }) => void;
  lastByExercise?: Map<string, LastEntry>;
  todayIdByExercise?: Map<string, string>;
  onSaveCarga?: SaveCarga;
  savingCarga?: boolean;
  activeKey?: string | null;
  onActivate?: (key: string | null) => void;
};

function ExerciseList({
  exercises,
  weekIdx,
  lookup,
  onPlay,
  lastByExercise,
  todayIdByExercise,
  onSaveCarga,
  savingCarga,
  activeKey,
  onActivate,
}: ListProps) {
  const items = useMemo(
    () => exercises.filter((e) => e.name || (e.weeks?.[weekIdx] ?? "").trim()),
    [exercises, weekIdx],
  );
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Sem exercícios nesta seção.</p>;
  }
  return (
    <div>
      {items.map((ex, i) => {
        const raw = ex.weeks?.[weekIdx] ?? "";
        const parsed = describeCell(raw);
        const video = ex.name ? lookup(ex.name) : null;
        const key = normalize(ex.name || "");
        const last = lastByExercise?.get(key) ?? null;
        const todayId = todayIdByExercise?.get(key);
        const isActive = !!key && activeKey === key;
        const isDone = !!todayId;
        const cls =
          "af-ex" +
          (isActive ? " af-ex--active" : "") +
          (isDone && !isActive ? " af-ex--done" : "");
        return (
          <div key={i} className={cls}>
            <div className="nm">
              <span className="flex items-center gap-2">
                {isDone && !isActive && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
                <span>{ex.name || "—"}</span>
              </span>
              {video && (
                <button
                  type="button"
                  className="af-iconbtn"
                  onClick={() => onPlay(video)}
                  aria-label="Ver vídeo"
                >
                  <Play className="w-[15px] h-[15px]" />
                </button>
              )}
            </div>
            <div className="af-row">
              {parsed.sets && parsed.reps ? (
                <>
                  <div className="af-m">
                    <span className="v">{parsed.sets}</span>
                    <span className="u">séries</span>
                  </div>
                  <div className="af-m">
                    <span className="v">{parsed.reps}</span>
                    <span className="u">reps</span>
                  </div>
                </>
              ) : raw ? (
                <div className="af-m">
                  <span className="v">{raw}</span>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
              {parsed.technique && <span className="af-tag2">{parsed.technique}</span>}
            </div>
            {ex.note && <div className="af-note">{ex.note}</div>}
            {onSaveCarga && onActivate && ex.name && (
              <RegistrarCarga
                exercise={ex.name}
                exerciseKey={key}
                last={last}
                todayId={todayId}
                prescribedReps={parsed.reps ?? ""}
                onSave={onSaveCarga}
                saving={!!savingCarga}
                active={isActive}
                onActivate={onActivate}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatBR(date: string) {
  if (!date) return "";
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

function RegistrarCarga({
  exercise,
  exerciseKey,
  last,
  todayId,
  prescribedReps,
  onSave,
  saving,
  active,
  onActivate,
}: {
  exercise: string;
  exerciseKey: string;
  last: LastEntry | null;
  todayId?: string;
  prescribedReps: string;
  onSave: SaveCarga;
  saving: boolean;
  active: boolean;
  onActivate: (key: string | null) => void;
}) {
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("");

  // Quando o aluno ativa o registro, semeia os campos com o último valor
  // (ou as reps prescritas) — mas só nesse momento, pra não sobrescrever
  // o que ele está digitando.
  useEffect(() => {
    if (active) {
      setLoad(last?.load ?? "");
      setReps(last?.reps || prescribedReps);
    }
  }, [active]);

  if (!active) {
    return (
      <button
        type="button"
        className="af-regbtn"
        onClick={() => onActivate(exerciseKey)}
      >
        {todayId ? (
          <>
            <Pencil className="w-[12px] h-[12px]" />
            Editar carga{last?.load ? ` · ${last.load}${last.reps ? ` × ${last.reps}` : ""}` : ""}
          </>
        ) : (
          <>
            <Check className="w-[12px] h-[12px]" />
            Registrar carga
            {last?.date ? ` · última ${last.load}${last.reps ? ` × ${last.reps}` : ""}` : ""}
          </>
        )}
      </button>
    );
  }

  return (
    <>
      <div className="af-logrow">
        <label className="af-field">
          <span className="fl">Carga</span>
          <input
            inputMode="decimal"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
            placeholder="kg"
            autoFocus
          />
        </label>
        <label className="af-field">
          <span className="fl">Reps</span>
          <input
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="—"
          />
        </label>
        <button
          type="button"
          className="af-savebtn"
          onClick={() =>
            onSave({ id: todayId, exercise, load: load.trim(), reps: reps.trim() })
          }
          disabled={saving || !load.trim()}
        >
          <Check className="w-[13px] h-[13px]" />
          {todayId ? "Atualizar" : "Registrar"}
        </button>
      </div>
      <button
        type="button"
        className="af-cancelbtn"
        onClick={() => onActivate(null)}
      >
        Cancelar
      </button>
      {last?.date && (
        <div className="af-lastval">
          Última: {last.load || "—"}
          {last.reps ? ` × ${last.reps}` : ""} · {formatBR(last.date)}
        </div>
      )}
    </>
  );
}
