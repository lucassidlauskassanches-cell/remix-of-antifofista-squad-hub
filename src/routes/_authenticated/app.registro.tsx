import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyDayRegistro,
  getMyWeightHistory,
  addWater,
  setWater,
  setTrained,
  upsertMealCheck,
  upsertWeightEntry,
} from "@/lib/registro.functions";
import { getMyContext } from "@/lib/squad.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Droplet,
  Scale,
  Share2,
  Download,
  Star,
  Trophy,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PatenteCard, getPatente } from "@/components/PatenteCard";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/_authenticated/app/registro")({
  component: RegistroPage,
  head: () => ({
    meta: [
      { title: "Meu Registro — Antifofista Squad" },
      {
        name: "description",
        content:
          "Check-in diário: água, peso, treino e refeições. Ganhe sua patente antifofista.",
      },
    ],
  }),
});

function todaySP(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function RegistroPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState<string>(todaySP());
  const fetchDay = useServerFn(getMyDayRegistro);
  const fetchCtx = useServerFn(getMyContext);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const dayQ = useQuery({
    queryKey: ["registro", date],
    queryFn: () => fetchDay({ data: { date } }),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["registro"] });
    qc.invalidateQueries({ queryKey: ["weight-history"] });
  };

  const addWaterFn = useServerFn(addWater);
  const setWaterFn = useServerFn(setWater);
  const setTrainedFn = useServerFn(setTrained);
  const mealFn = useServerFn(upsertMealCheck);

  const mAddWater = useMutation({
    mutationFn: (deltaMl: number) => addWaterFn({ data: { deltaMl, date } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
  const mSetWater = useMutation({
    mutationFn: (waterMl: number) => setWaterFn({ data: { waterMl, date } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
  const mTrained = useMutation({
    mutationFn: (t: boolean) => setTrainedFn({ data: { trained: t, date } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
  const mMeal = useMutation({
    mutationFn: (v: { mealCheckId: string; done?: boolean; rating?: number }) =>
      mealFn({ data: { ...v, date } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  if (!dayQ.data) return <p className="p-4">Carregando...</p>;
  const d = dayQ.data;
  const goal = d.waterGoalMl;
  const consumed = d.log?.water_ml ?? 0;
  const score = Number(d.log?.daily_score ?? 0);
  const readOnly = !d.isToday;
  const studentName = ctxQ.data?.profile?.full_name ?? "Soldado";

  return (
    <div className="space-y-4">
      {/* header: date nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDate((cur) => addDays(cur, -1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <div className="tactical-heading text-xl">
            {d.isToday
              ? "HOJE"
              : new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                })}
          </div>
          {!d.isToday && (
            <button
              onClick={() => setDate(todaySP())}
              className="text-xs text-primary underline"
            >
              voltar pra hoje
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDate((cur) => addDays(cur, 1))}
          disabled={date >= todaySP()}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* SCORE */}
      <ScoreBanner score={score} readOnly={readOnly} onShare={() => {}} />

      {/* WATER */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Droplet className="w-4 h-4 text-primary" />
          <h2 className="tactical-heading text-sm tracking-widest">ÁGUA</h2>
        </div>
        <WaterRing consumed={consumed} goal={goal} />
        <div className="text-center text-xs text-muted-foreground">
          Meta: {goal ? `${(goal / 1000).toFixed(2)} L` : "defina seu peso"} —
          coeficiente {d.waterMlPerKg} ml/kg
        </div>
        {!readOnly && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {[250, 500, 1000].map((v) => (
                <Button
                  key={v}
                  variant="outline"
                  onClick={() => mAddWater.mutate(v)}
                  disabled={mAddWater.isPending || !goal}
                >
                  +{v >= 1000 ? `${v / 1000}L` : `${v}ml`}
                </Button>
              ))}
              <Button
                variant="outline"
                onClick={() => mAddWater.mutate(-250)}
                disabled={mAddWater.isPending || consumed <= 0}
              >
                −250
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                max={20000}
                placeholder="Total ml"
                defaultValue={consumed}
                key={consumed}
                onBlur={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (Number.isFinite(v) && v !== consumed)
                    mSetWater.mutate(v);
                }}
              />
            </div>
          </>
        )}
      </Card>

      {/* TREINO */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-primary" />
          <h2 className="tactical-heading text-sm tracking-widest">
            TREINO DE HOJE
          </h2>
        </div>
        <Button
          variant={d.log?.trained ? "default" : "outline"}
          className="w-full"
          onClick={() => mTrained.mutate(!d.log?.trained)}
          disabled={readOnly || mTrained.isPending}
        >
          {d.log?.trained ? "✓ TREINEI HOJE" : "MARCAR: TREINEI HOJE"}
        </Button>
      </Card>

      {/* REFEIÇÕES */}
      <Card className="p-4 space-y-3">
        <h2 className="tactical-heading text-sm tracking-widest">
          REFEIÇÕES DO DIA
        </h2>
        {d.meals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sem plano nutricional ativo. Peça para o seu treinador subir a
            dieta.
          </p>
        ) : (
          d.meals.map((m) => (
            <MealRow
              key={m.id}
              meal={m}
              readOnly={readOnly}
              onDone={(done) =>
                mMeal.mutate({ mealCheckId: m.id, done })
              }
              onRate={(rating) =>
                mMeal.mutate({ mealCheckId: m.id, rating, done: true })
              }
            />
          ))
        )}
      </Card>

      {/* PESO */}
      <WeightCard currentKg={d.weightKg} onSaved={invalidateAll} />

      {/* SHARE */}
      <ShareSection score={score} date={date} studentName={studentName} />
    </div>
  );
}

// ---------- score banner ----------
function ScoreBanner({ score, readOnly }: { score: number; readOnly: boolean; onShare: () => void }) {
  const p = getPatente(score);
  return (
    <Card
      className="p-4 border-2 relative overflow-hidden"
      style={{ borderColor: p.accent }}
    >
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6" style={{ color: p.accent }} />
        <div className="flex-1">
          <div className="text-[10px] tracking-widest text-muted-foreground">
            {readOnly ? "SCORE DO DIA" : "SCORE ATUAL"}
          </div>
          <div
            className="tactical-heading text-4xl leading-none"
            style={{ color: p.accent }}
          >
            {Math.round(score)}%
          </div>
        </div>
      </div>
      <div
        className="mt-2 tactical-heading text-sm tracking-widest"
        style={{ color: p.accent }}
      >
        {p.rank}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{p.message}</p>
    </Card>
  );
}

// ---------- water ring ----------
function WaterRing({ consumed, goal }: { consumed: number; goal: number }) {
  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  return (
    <div className="flex justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={off}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 300ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="tactical-heading text-2xl">
            {(consumed / 1000).toFixed(2)}L
          </div>
          <div className="text-[10px] text-muted-foreground">
            {Math.round(pct * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- meal row ----------
function MealRow({
  meal,
  readOnly,
  onDone,
  onRate,
}: {
  meal: { id: string; meal_name: string; done: boolean; rating: number };
  readOnly: boolean;
  onDone: (done: boolean) => void;
  onRate: (rating: number) => void;
}) {
  return (
    <div className="border border-border rounded p-3 space-y-2">
      <button
        onClick={() => !readOnly && onDone(!meal.done)}
        disabled={readOnly}
        className={`w-full flex items-center gap-2 text-left ${
          meal.done ? "text-primary" : "text-foreground"
        }`}
      >
        <span
          className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${
            meal.done
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground"
          }`}
        >
          {meal.done ? "✓" : ""}
        </span>
        <span className="tactical-heading text-sm flex-1">
          {meal.meal_name}
        </span>
      </button>
      {meal.done && (
        <div className="flex items-center gap-1 pl-7">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => !readOnly && onRate(n)}
              disabled={readOnly}
              aria-label={`${n} estrelas`}
            >
              <Star
                className="w-5 h-5"
                fill={n <= meal.rating ? "currentColor" : "none"}
                style={{
                  color: n <= meal.rating ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                }}
              />
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            fidelidade
          </span>
        </div>
      )}
    </div>
  );
}

// ---------- weight ----------
function WeightCard({
  currentKg,
  onSaved,
}: {
  currentKg: number;
  onSaved: () => void;
}) {
  const fetchHist = useServerFn(getMyWeightHistory);
  const upsert = useServerFn(upsertWeightEntry);
  const [val, setVal] = useState<string>("");
  const histQ = useQuery({
    queryKey: ["weight-history"],
    queryFn: () => fetchHist(),
  });
  const mSave = useMutation({
    mutationFn: (kg: number) => upsert({ data: { weightKg: kg } }),
    onSuccess: () => {
      toast.success("Peso registrado");
      setVal("");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const data =
    histQ.data?.entries.map((e) => ({
      date: e.entry_date.slice(5), // MM-DD
      kg: Number(e.weight_kg),
    })) ?? [];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-primary" />
        <h2 className="tactical-heading text-sm tracking-widest">PESO</h2>
        {currentKg > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            atual: {currentKg.toFixed(1)} kg
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          step="0.1"
          min={20}
          max={400}
          placeholder="Peso (kg) de hoje"
          value={val}
          onChange={(e) => setVal(e.currentTarget.value)}
        />
        <Button
          onClick={() => {
            const n = Number(val);
            if (Number.isFinite(n) && n >= 20 && n <= 400) mSave.mutate(n);
            else toast.error("Peso inválido");
          }}
          disabled={mSave.isPending || !val}
        >
          REGISTRAR
        </Button>
      </div>
      {data.length >= 2 && (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="kg"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// ---------- share ----------
function ShareSection({
  score,
  date,
  studentName,
}: {
  score: number;
  date: string;
  studentName: string;
}) {
  const [format, setFormat] = useState<"story" | "square">("story");
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  async function capture(): Promise<Blob | null> {
    if (!cardRef.current) return null;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: "#000",
      scale: 1,
      useCORS: true,
      logging: false,
    });
    return await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/png", 0.95),
    );
  }

  async function handleShare() {
    setBusy(true);
    try {
      const blob = await capture();
      if (!blob) throw new Error("Falha ao gerar imagem");
      const file = new File([blob], `antifofista-${date}.png`, {
        type: "image/png",
      });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Antifofista Squad",
          text: `Score de hoje: ${Math.round(score)}% — ${getPatente(score).rank}`,
        });
      } else {
        // fallback download
        downloadBlob(blob, `antifofista-${date}.png`);
        toast.info("Compartilhamento nativo indisponível — imagem baixada.");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const blob = await capture();
      if (blob) downloadBlob(blob, `antifofista-${date}.png`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <h2 className="tactical-heading text-sm tracking-widest">
        COMPARTILHAR PATENTE
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={format === "story" ? "default" : "outline"}
          onClick={() => setFormat("story")}
          size="sm"
        >
          STORY 9:16
        </Button>
        <Button
          variant={format === "square" ? "default" : "outline"}
          onClick={() => setFormat("square")}
          size="sm"
        >
          FEED 1:1
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleShare} disabled={busy}>
          <Share2 className="w-4 h-4 mr-2" /> COMPARTILHAR
        </Button>
        <Button variant="outline" onClick={handleDownload} disabled={busy}>
          <Download className="w-4 h-4 mr-2" /> SALVAR
        </Button>
      </div>

      {/* Hidden card for html2canvas — positioned off-screen but rendered */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: -99999,
          pointerEvents: "none",
          opacity: 0,
        }}
        aria-hidden
      >
        <PatenteCard
          ref={cardRef}
          score={score}
          date={date}
          studentName={studentName}
          format={format}
        />
      </div>
    </Card>
  );
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
