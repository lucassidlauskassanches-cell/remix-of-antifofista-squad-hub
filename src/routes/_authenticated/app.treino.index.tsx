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
        const cls = "af-ex" + (isActive ? " af-ex--active" : "");
        const canRegister = !!(onSaveCarga && onActivate && ex.name);
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
                  onOpen={() => onActivate!(key)}
                />
              )}
            </div>
            {ex.note && <div className="af-note">{ex.note}</div>}
            {canRegister && !isActive && !todayId && last?.date && (
              <div className="af-loghint">
                ↳ última: {last.load || "—"}
                {last.reps ? ` × ${last.reps}` : ""} · {formatBR(last.date)}
              </div>
            )}
            {canRegister && isActive && (
              <LogEdit
                exercise={ex.name!}
                last={last}
                todayId={todayId}
                prescribedReps={parsed.reps ?? ""}
                prescribedSets={parsed.sets ?? ""}
                onSave={onSaveCarga!}
                saving={!!savingCarga}
                onClose={() => onActivate!(null)}
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
  onSave,
  saving,
  onClose,
}: {
  exercise: string;
  last: LastEntry | null;
  todayId?: string;
  prescribedReps: string;
  prescribedSets: string;
  onSave: SaveCarga;
  saving: boolean;
  onClose: () => void;
}) {
  const initialSetCount = (() => {
    const fromLast = Math.max(
      (last?.load ?? "").split("/").length,
      (last?.reps ?? "").split("/").length,
    );
    if (last?.load && fromLast > 0) return fromLast;
    const p = parseInt(prescribedSets, 10);
    if (Number.isFinite(p) && p > 0) return p;
    return 1;
  })();

  const initialLoads = (() => {
    const arr = (last?.load ?? "").split("/").map((s) => s.trim());
    while (arr.length < initialSetCount) arr.push("");
    return arr.slice(0, initialSetCount);
  })();

  const initialReps = (() => {
    const arr = (last?.reps ?? "").split("/").map((s) => s.trim());
    if (arr.filter(Boolean).length === 0 && prescribedReps) {
      return Array(initialSetCount).fill(prescribedReps.trim());
    }
    while (arr.length < initialSetCount) arr.push(prescribedReps.trim());
    return arr.slice(0, initialSetCount);
  })();

  const [loads, setLoads] = useState<string[]>(initialLoads);
  const [reps, setReps] = useState<string[]>(initialReps);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [onClose]);

  function addSet() {
    setLoads((a) => [...a, ""]);
    setReps((a) => [...a, prescribedReps.trim()]);
  }
  function removeSet(i: number) {
    if (loads.length <= 1) return;
    setLoads((a) => a.filter((_, k) => k !== i));
    setReps((a) => a.filter((_, k) => k !== i));
  }
  function updateLoad(i: number, v: string) {
    setLoads((a) => a.map((x, k) => (k === i ? v : x)));
  }
  function updateReps(i: number, v: string) {
    setReps((a) => a.map((x, k) => (k === i ? v : x)));
  }

  function submit() {
    const hasAny = loads.some((l) => l.trim());
    if (!hasAny || saving) return;
    const load = loads.map((l) => l.trim() || "-").join("/");
    const rep = reps.map((r) => r.trim() || "-").join("/");
    onSave({ id: todayId, exercise, load, reps: rep });
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
          <button
            type="button"
            className="af-setbtn"
            onClick={() => removeSet(i)}
            disabled={loads.length <= 1}
            aria-label="Remover série"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className="af-logsetsfoot">
        <button type="button" className="af-addset" onClick={addSet}>
          <Plus className="w-3.5 h-3.5" /> Série
        </button>
        <button
          type="button"
          className="af-savesets"
          onClick={submit}
          disabled={saving || !loads.some((l) => l.trim())}
        >
          <Check className="w-4 h-4" />
          {todayId ? "Atualizar" : "Registrar"}
        </button>
      </div>
    </div>
  );
}

function RestTimer() {
  const [defaultSec, setDefaultSec] = useState<number>(() => {
    if (typeof window === "undefined") return 90;
    const v = Number(localStorage.getItem("treino:restSec"));
    return Number.isFinite(v) && v > 0 ? v : 90;
  });
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("treino:restSec", String(defaultSec));
    }
  }, [defaultSec]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (endAtRef.current == null) return;
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
        endAtRef.current = null;
        beep();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  function beep() {
    try {
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = audioRef.current ?? new Ctx();
      audioRef.current = ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.15;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.35);
      if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
    } catch {}
  }

  function start() {
    endAtRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  }
  function pause() {
    setRunning(false);
    endAtRef.current = null;
  }
  function reset() {
    setRunning(false);
    endAtRef.current = null;
    setRemaining(defaultSec);
  }
  function bump(delta: number) {
    const next = Math.max(5, Math.min(900, defaultSec + delta));
    setDefaultSec(next);
    if (!running) setRemaining(next);
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
        <button type="button" className="stp" onClick={() => bump(-15)} aria-label="-15s">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="big">
          {mm}:{ss}
        </div>
        <button type="button" className="stp" onClick={() => bump(15)} aria-label="+15s">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="af-timer-foot">
        {running ? (
          <button type="button" className="prm" onClick={pause} aria-label="Pausar">
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" className="prm" onClick={start} aria-label="Iniciar">
            <Play className="w-4 h-4" />
          </button>
        )}
        <button type="button" className="sec" onClick={reset} aria-label="Resetar">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

