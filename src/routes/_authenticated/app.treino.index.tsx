import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Play, Check, Table2, LayoutList, Plus, Minus, Timer, Pause, RotateCcw, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { REST_TIMER_KEY, remainingRestSeconds, startRestTimer } from "@/lib/rest-timer";
import { currentTrainingWeek, prescribedSetCount, sameWeekEntries, type WeekLogRow } from "@/lib/training-logbook";
import {
  describeCell,
  type StructuredPlan,
  type StructuredExercise,
  type StructuredBlock,
} from "@/lib/training-xlsx-parser";

function todayStr() {
  // Brasília timezone (UTC-3, no DST) — matches server-side date computations.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type LastEntry = { load: string; reps: string; date: string; sets: { load: string; reps: string }[] };
type SaveCarga = (v: {
  exercise: string;
  week_number: number;
  block_label: string;
  sets: { load: string; reps: string }[];
}) => Promise<void>;

// ---- Rascunho local do editor de série (por exercício + dia) ----
type LogDraft = { loads: string[]; reps: string[] };

function draftKey(exercise: string) {
  return `treino:draft:${todayStr()}:${exercise}`;
}
function readDraft(exercise: string): LogDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(exercise));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!Array.isArray(p?.loads) || !Array.isArray(p?.reps)) return null;
    return {
      loads: p.loads.map((x: unknown) => String(x ?? "")),
      reps: p.reps.map((x: unknown) => String(x ?? "")),
    };
  } catch {
    return null;
  }
}
function writeDraft(exercise: string, d: LogDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(draftKey(exercise), JSON.stringify(d));
  } catch {
    /* storage cheio/indisponível — ignora */
  }
}
function clearDraft(exercise: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftKey(exercise));
  } catch {
    /* ignora */
  }
}


export const Route = createFileRoute("/_authenticated/app/treino/")({
  head: () => ({ meta: [
    { title: "Treino por semana — Antifofista Squad" },
    { name: "description", content: "Treinos e cargas por semana e série no Antifofista Squad." },
    { property: "og:title", content: "Treino por semana — Antifofista Squad" },
    { property: "og:description", content: "Sua periodização e registros de cargas por série." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
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

// "SEMANA 1", "SEMANA 2" — usada nos cabeçalhos da tabela e no chip ativo.
function weekLabel(label: string, i: number) {
  const m = (label || "").match(/(\d+)/);
  return `Semana ${m ? m[1] : i + 1}`;
}
// Só o número, para os chips inativos (mantém o strip compacto).
function weekNumber(label: string, i: number) {
  const m = (label || "").match(/(\d+)/);
  return m ? m[1] : String(i + 1);
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
    retry: 2,
    retryDelay: (attempt) => 400 * (attempt + 1),
    mutationFn: async (v: Parameters<SaveCarga>[0]) => {
      // Keep the draft until every prescribed set has been confirmed.
      for (let i = 0; i < v.sets.length; i++) {
        await save({ data: {
          exercise: v.exercise, week_number: v.week_number, set_index: i + 1,
          block_label: v.block_label, load: v.sets[i].load,
          reps: v.sets[i].reps, entry_date: todayStr(), order_index: i,
        } });
      }
    },
    onSuccess: (_d, v) => {
      clearDraft(`${v.week_number}:${v.block_label}:${normalize(v.exercise)}`);
      queryClient.invalidateQueries({ queryKey: ["my-logbook"] });
      toast.success("Carga registrada");
      setActiveKey(null);
    },

    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        /fetch|network|Load failed/i.test(msg)
          ? "Sem conexão agora. Seus valores ficaram salvos — toque em Registrar novamente."
          : msg || "Falha ao registrar",
      );
    },
  });
  const saveCarga: SaveCarga = async (v) => {
    await saveMutation.mutateAsync(v);
  };

  const galleryMap = useMemo(() => {
    const m = new Map<string, { title: string; url: string }>();
    (galleryData?.items ?? []).forEach((it: any) => {
      const key = normalize(it.title);
      if (key && !m.has(key)) m.set(key, { title: it.title, url: it.youtube_url });
    });
    return m;
  }, [galleryData]);

  const plan = (data?.plan ?? null) as StructuredPlan | null;
  // Apenas informativo (badge "Semana vigente") — nunca define a semana exibida.
  const currentWeek = currentTrainingWeek(data?.start_date ?? "", todayStr());
  const [weekIdx, setWeekIdx] = useState(0);
  const [blockIdx, setBlockIdx] = useState(0);
  const [video, setVideo] = useState<{ url: string; title: string } | null>(null);
  const [planilha, setPlanilha] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const b = Number(localStorage.getItem("treino:blockIdx"));
    if (Number.isFinite(b) && b >= 0) setBlockIdx(b);
    // Semana escolhida pelo aluno: restaura onde ele parou (padrão: Semana 1).
    const w = Number(localStorage.getItem("treino:weekIdx"));
    if (Number.isFinite(w) && w >= 0) setWeekIdx(w);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    localStorage.setItem("treino:blockIdx", String(blockIdx));
    localStorage.setItem("treino:weekIdx", String(weekIdx));
  }, [weekIdx, blockIdx, restored]);

  // Trocar bloco/semana fecha o exercício em edição pra não perder foco.
  useEffect(() => {
    setActiveKey(null);
  }, [blockIdx, weekIdx]);

  // Esc fecha o exercício em edição.
  useEffect(() => {
    if (!activeKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveKey(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeKey]);

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
    logRows: (logData?.rows ?? []) as WeekLogRow[],
    blockLabel: block.name,
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

      <div className="af-controls">
        <div className="af-controls-left">
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

          <div className="af-wk-label">Semana</div>
          <div className="af-week">
            {plan.weeks.map((w, i) => (
              <button
                key={i}
                type="button"
                className={`af-wk${i === safeWeekIdx ? " on" : ""}`}
                onClick={() => setWeekIdx(i)}
                aria-label={weekLabel(w, i)}
              >
                {i === safeWeekIdx ? weekLabel(w, i) : weekNumber(w, i)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {currentWeek > plan.weeks.length ? "Ciclo concluído · você ainda pode registrar em qualquer semana" : currentWeek < 1 ? "Plano ainda não iniciado · registro liberado" : safeWeekIdx + 1 === currentWeek ? "Semana vigente" : "Você pode registrar nesta semana"}
      </p>
      <RestTimer />


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
                <span>Abdominal</span>
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
                {weekLabel(w, i)}
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
  logRows?: WeekLogRow[];
  blockLabel?: string;
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
  logRows,
  blockLabel = "",
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
        const allRows = (logRows ?? []).filter((r) => normalize(r.exercise) === key);
        const weekRows = sameWeekEntries(logRows ?? [], weekIdx + 1)
          .filter((r) => normalize(r.exercise) === key && (!r.block_label || r.block_label === blockLabel));
        // Referência "última" é global: o registro mais recente do exercício,
        // em qualquer semana ou bloco — igual à aba Progressão.
        const lastAny: LastEntry | null = (() => {
          if (!allRows.length) return null;
          const date = allRows.reduce((d, r) => (r.entry_date > d ? r.entry_date : d), "");
          const rows = allRows
            .filter((r) => r.entry_date === date)
            .sort((a, b) => (a.set_index ?? 0) - (b.set_index ?? 0) || (a.id < b.id ? -1 : 1));
          return {
            load: rows.map((r) => r.load).join("/"),
            reps: rows.map((r) => r.reps).join("/"),
            date,
            sets: [],
          };
        })();
        // Pré-preenchimento do editor e selo do chip: só a semana/bloco em vista.
        const last: LastEntry | null = weekRows.length ? {
          load: weekRows.map((r) => r.load).join("/"),
          reps: weekRows.map((r) => r.reps).join("/"),
          date: weekRows.reduce((d, r) => r.entry_date > d ? r.entry_date : d, ""),
          sets: Array.from({ length: Math.max(...weekRows.map((r) => r.set_index ?? 0)) }, (_, i) => {
            const row = weekRows.find((r) => r.set_index === i + 1);
            return { load: row?.load ?? "", reps: row?.reps ?? "" };
          }),
        } : null;
        const todayId = weekRows[0]?.id;
        const isActive = !!key && activeKey === key;
        const cls = "af-ex" + (isActive ? " af-ex--active" : "");
        const canRegister = !!(onSaveCarga && onActivate && ex.name && raw.trim());
        return (
          <div key={i} className={cls}>
            <div className="nm">
              <span>{ex.name || "—"}</span>
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
              {canRegister && !isActive && (
                <LogChip
                  todayId={todayId}
                  last={last}
                  onOpen={() => onActivate?.(key)}
                />
              )}
            </div>
            {ex.note && <div className="af-note">{ex.note}</div>}
            {!isActive && lastAny?.date && (
              <div className="af-loghint">
                ↳ última: {lastAny.load || "—"}
                {lastAny.reps ? ` × ${lastAny.reps}` : ""} · {formatBR(lastAny.date)}
              </div>
            )}
            {canRegister && isActive && (
              <LogEdit
                exercise={ex.name}
                weekNumber={weekIdx + 1}
                blockLabel={blockLabel}
                last={last}
                todayId={todayId}
                prescribedReps={parsed.reps ?? ""}
                prescribedSets={parsed.sets ?? ""}
                onSave={async (value) => { if (onSaveCarga) await onSaveCarga(value); }}
                saving={!!savingCarga}
                onClose={() => onActivate?.(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LogChip({
  todayId,
  last,
  onOpen,
}: {
  todayId?: string;
  last: LastEntry | null;
  onOpen: () => void;
}) {
  const filled = !!todayId;
  const load = last?.load?.trim() || "";
  const reps = last?.reps?.trim() || "";
  return (
    <Button asChild>
    <button
      type="button"
      className={`af-logchip${filled ? " filled" : ""}`}
      onClick={onOpen}
      aria-label={filled ? "Editar carga" : "Registrar carga"}
    >
      {filled ? (
        <>
          <Check className="w-3 h-3" />
          <span className="n">{load || "—"}</span>
          {reps && <span className="x">× {reps}</span>}
        </>
      ) : (
        <>
          <span>Registrar</span>
        </>
      )}
    </button>
    </Button>
  );
}

function formatBR(date: string) {
  if (!date) return "";
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

function LogEdit({
  exercise,
  last,
  todayId,
  prescribedReps,
  prescribedSets,
  weekNumber,
  blockLabel,
  onSave,
  saving,
  onClose,
}: {
  exercise: string;
  last: LastEntry | null;
  todayId?: string;
  prescribedReps: string;
  prescribedSets: string;
  weekNumber: number;
  blockLabel: string;
  onSave: SaveCarga;
  saving: boolean;
  onClose: () => void;
}) {
  const initialSetCount = prescribedSetCount(prescribedSets);
  const draftScope = `${weekNumber}:${blockLabel}:${normalize(exercise)}`;
  const draft = readDraft(draftScope);
  const [loads, setLoads] = useState<string[]>(() => Array.from({ length: initialSetCount }, (_, i) =>
    draft?.loads[i] ?? last?.sets[i]?.load ?? ""));
  const [reps, setReps] = useState<string[]>(() => Array.from({ length: initialSetCount }, (_, i) =>
    draft?.reps[i] ?? last?.sets[i]?.reps ?? prescribedReps.trim()));
  const wrapRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const submittedRef = useRef(false);

  // Persiste o rascunho a cada alteração.
  useEffect(() => {
    if (!dirtyRef.current || submittedRef.current) return;
    writeDraft(draftScope, { loads, reps });
  }, [draftScope, loads, reps]);

  async function submit() {
    const hasAny = loads.some((l) => l.trim());
    if (!hasAny || saving || submittedRef.current) return;
    submittedRef.current = true;

    // Garante que o rascunho está gravado antes de tentar salvar no servidor.
    writeDraft(draftScope, { loads, reps });
    try {
      await onSave({ exercise, week_number: weekNumber, block_label: blockLabel,
        sets: loads.map((l, i) => ({ load: l.trim() || "-", reps: reps[i]?.trim() || "-" })) });
    } catch {
      // Falhou: libera para o aluno tentar registrar de novo sem perder nada.
      submittedRef.current = false;
    }
  }

  // Fechar nunca descarta: o rascunho fica salvo e, se houver carga, salva de verdade.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    let scrolled = false;
    // Pequeno atraso pra não fechar pelo mesmo toque que abriu o editor.
    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 350);

    function onTouchMove() {
      scrolled = true;
    }
    function onTouchEnd() {
      window.setTimeout(() => {
        scrolled = false;
      }, 120);
    }
    function onDown(e: PointerEvent) {
      if (!armed || scrolled) return;
      const el = wrapRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && el.contains(target)) return;
      // Toque fora: salva se houver carga preenchida, senão só fecha (rascunho preservado).
      if (loads.some((l) => l.trim())) submitRef.current();
      closeRef.current();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.clearTimeout(arm);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [loads]);

  function updateLoad(i: number, v: string) {
    dirtyRef.current = true;
    setLoads((a) => a.map((x, k) => (k === i ? v : x)));
  }
  function updateReps(i: number, v: string) {
    dirtyRef.current = true;
    setReps((a) => a.map((x, k) => (k === i ? v : x)));
  }


  return (
    <div ref={wrapRef} className="af-logsets">
      {loads.map((l, i) => (
        <div key={i} className="af-logsetrow">
          <span className="af-setno">{i + 1}</span>
          <label className="fld">
            <span className="fl">Carga</span>
            <input
              inputMode="decimal"
              value={l}
              onChange={(e) => updateLoad(i, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="kg"
              autoFocus={i === 0}
            />
          </label>
          <label className="fld">
            <span className="fl">Reps</span>
            <input
              inputMode="numeric"
              value={reps[i] ?? ""}
              onChange={(e) => updateReps(i, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="—"
            />
          </label>

        </div>
      ))}
      <div className="af-logsetsfoot">
        <Button
          type="button"
          className="af-savesets"
          onClick={submit}
          disabled={saving || !loads.some((l) => l.trim())}
        >
          <Check className="w-4 h-4" />
          {todayId ? "Atualizar" : "Registrar"}
        </Button>
      </div>
    </div>
  );
}

function RestTimer() {
  const [defaultSec, setDefaultSec] = useState(90);
  const [remaining, setRemaining] = useState<number>(defaultSec);
  const [running, setRunning] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // Drag state — position saved in viewport-relative coords (px from top-left).
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number; pointerId: number } | null>(null);

  // Load saved position (or default to bottom-right, above bottom nav)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("treino:timerPos");
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 156;
    const h = el?.offsetHeight ?? 150;
    const margin = 12;
    const bottomNav = 96;
    if (raw) {
      try {
        const p = JSON.parse(raw) as { x: number; y: number };
        setPos(clamp(p.x, p.y, w, h));
        return;
      } catch {}
    }
    setPos({
      x: Math.max(margin, window.innerWidth - w - margin),
      y: Math.max(margin, window.innerHeight - h - bottomNav),
    });
  }, []);

  function clamp(x: number, y: number, w: number, h: number) {
    const margin = 4;
    const maxX = Math.max(margin, window.innerWidth - w - margin);
    const maxY = Math.max(margin, window.innerHeight - h - margin);
    return { x: Math.min(Math.max(margin, x), maxX), y: Math.min(Math.max(margin, y), maxY) };
  }

  // Reclamp on viewport resize
  useEffect(() => {
    function onResize() {
      const el = rootRef.current;
      if (!el || !pos) return;
      setPos((p) => (p ? clamp(p.x, p.y, el.offsetWidth, el.offsetHeight) : p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = rootRef.current;
    if (!el || !pos) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, pointerId: e.pointerId };
    setDragging(true);
    e.preventDefault();
  }
  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = rootRef.current;
    if (!drag || !el || drag.pointerId !== e.pointerId) return;
    const next = clamp(e.clientX - drag.dx, e.clientY - drag.dy, el.offsetWidth, el.offsetHeight);
    setPos(next);
  }
  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (pos) localStorage.setItem("treino:timerPos", JSON.stringify(pos));
  }

  const restoredRef = useRef(false);
  useEffect(() => {
    try {
      const duration = Number(localStorage.getItem("treino:restSec")) || 90;
      setDefaultSec(duration);
      const saved = JSON.parse(localStorage.getItem(REST_TIMER_KEY) ?? "null");
      if (saved && typeof saved.remaining === "number") {
        endAtRef.current = typeof saved.endAt === "number" ? saved.endAt : null;
        setRemaining(endAtRef.current === null ? saved.remaining : remainingRestSeconds(endAtRef.current));
        setRunning(endAtRef.current !== null);
      } else setRemaining(duration);
    } catch {}
    restoredRef.current = true;
  }, []);

  useEffect(() => {
    if (restoredRef.current) {
      try { localStorage.setItem("treino:restSec", String(defaultSec)); } catch {}
    }
  }, [defaultSec]);

  function persist(endAt: number | null, seconds: number) {
    try { localStorage.setItem(REST_TIMER_KEY, JSON.stringify({ endAt, remaining: seconds })); } catch {}
  }

  useEffect(() => {
    if (!running) return;
    function tick() {
      const end = endAtRef.current;
      if (end === null) return;
      const left = remainingRestSeconds(end);
      setRemaining(left);
      if (left === 0) {
        // Clear the deadline first: visibility and interval may fire together.
        endAtRef.current = null;
        persist(null, 0);
        setRunning(false);
        beep();
        toast.success("Descanso concluído");
      }
    }
    tick();
    const id = window.setInterval(tick, 200);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pageshow", tick);
      window.removeEventListener("focus", tick);
    };
  }, [running]);

  function unlockAudio() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx && !audioRef.current) audioRef.current = new Ctx();
      if (audioRef.current?.state === "suspended") void audioRef.current.resume().catch(() => {});
    } catch {}
  }
  function beep() {
    try { navigator.vibrate?.([200, 80, 200]); } catch {}
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.15;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.5);
    } catch {}
  }
  function start() {
    unlockAudio();
    const seconds = remaining > 0 ? remaining : defaultSec;
    const state = startRestTimer(seconds);
    endAtRef.current = state.endAt;
    persist(state.endAt, seconds);
    setRemaining(seconds);
    setRunning(true);
  }
  function pause() {
    const seconds = endAtRef.current === null ? remaining : remainingRestSeconds(endAtRef.current);
    endAtRef.current = null;
    persist(null, seconds);
    setRemaining(seconds);
    setRunning(false);
  }
  function reset() {
    endAtRef.current = null;
    persist(null, defaultSec);
    setRunning(false);
    setRemaining(defaultSec);
  }
  function bump(delta: number) {
    const next = Math.max(5, Math.min(900, defaultSec + delta));
    setDefaultSec(next);
    if (!running) { setRemaining(next); persist(null, next); }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 12, bottom: 96 };

  return (
    <div
      ref={rootRef}
      className={`af-timer af-timer-float${dragging ? " dragging" : ""}`}
      style={style}
    >
      <div
        className="af-timer-drag"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        role="button"
        aria-label="Arrastar timer"
      >
        <GripVertical className="w-3.5 h-3.5" />
        <div className="af-timer-head">
          <Timer className="w-3.5 h-3.5" />
          <span>Descanso</span>
        </div>
      </div>
      <div className="af-timer-body">
        <Button variant="ghost" type="button" className="stp" onClick={() => bump(-15)} aria-label="-15s">
          <Minus className="w-3.5 h-3.5" />
        </Button>
        <div className="big">
          {mm}:{ss}
        </div>
        <Button variant="ghost" type="button" className="stp" onClick={() => bump(15)} aria-label="+15s">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="af-timer-foot">
        {running ? (
          <Button variant="ghost" type="button" className="prm" onClick={pause} aria-label="Pausar">
            <Pause className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="ghost" type="button" className="prm" onClick={start} aria-label="Iniciar">
            <Play className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" type="button" className="sec" onClick={reset} aria-label="Resetar">
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

