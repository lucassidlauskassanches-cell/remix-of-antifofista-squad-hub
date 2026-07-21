import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Flame, Users } from "lucide-react";
import { getLeaderboard, getTrainerLeaderboard } from "@/lib/leaderboard.functions";
import { getMyContext } from "@/lib/access.functions";

type Period = "weekly" | "monthly";

export const Route = createFileRoute("/_authenticated/app/admin/ranking")({
  component: RankingPage,
  head: () => ({ meta: [{ title: "Ranking — Antifofista Squad" }] }),
});

function RankingPage() {
  const fetchCtx = useServerFn(getMyContext);
  const { data: ctx } = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });

  const [period, setPeriod] = useState<Period>("weekly");
  const [search, setSearch] = useState("");
  const [trainerFilter, setTrainerFilter] = useState<string>("");
  const [tab, setTab] = useState<"alunos" | "treinadores">("alunos");

  const fetchLb = useServerFn(getLeaderboard);
  const { data, isPending } = useQuery({
    queryKey: ["leaderboard", "admin", period],
    queryFn: () => fetchLb({ data: { period } }),
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];

  const trainerOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.trainer_id) map.set(r.trainer_id, r.trainer_name ?? "—");
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (trainerFilter && r.trainer_id !== trainerFilter) return false;
      if (q && !r.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, trainerFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        <h1 className="tactical-heading text-lg tracking-widest">RANKING DA SQUAD</h1>
      </div>

      {ctx?.isAdmin && (
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <Button
            size="sm"
            variant={tab === "alunos" ? "default" : "ghost"}
            className="rounded-none text-xs tactical-heading"
            onClick={() => setTab("alunos")}
          >
            <Users className="w-3.5 h-3.5 mr-1" /> ALUNOS
          </Button>
          <Button
            size="sm"
            variant={tab === "treinadores" ? "default" : "ghost"}
            className="rounded-none text-xs tactical-heading"
            onClick={() => setTab("treinadores")}
          >
            TREINADORES
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <Button
            size="sm"
            variant={period === "weekly" ? "default" : "ghost"}
            className="rounded-none text-xs tactical-heading"
            onClick={() => setPeriod("weekly")}
          >
            SEMANAL
          </Button>
          <Button
            size="sm"
            variant={period === "monthly" ? "default" : "ghost"}
            className="rounded-none text-xs tactical-heading"
            onClick={() => setPeriod("monthly")}
          >
            MENSAL
          </Button>
        </div>
        {tab === "alunos" && (
          <>
            <Input
              placeholder="Buscar aluno..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-9"
            />
            {ctx?.isAdmin && trainerOptions.length > 0 && (
              <select
                value={trainerFilter}
                onChange={(e) => setTrainerFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">Todos treinadores</option>
                {trainerOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      {tab === "alunos" ? (
        <StudentsList rows={filtered} isPending={isPending} showTrainer={!!ctx?.isAdmin} />
      ) : (
        <TrainersList period={period} />
      )}
    </div>
  );
}

function StudentsList({
  rows,
  isPending,
  showTrainer,
}: {
  rows: Array<{
    student_id: string;
    full_name: string;
    trainer_name: string | null;
    points: number;
    current_streak: number;
    rank_position: number;
  }>;
  isPending: boolean;
  showTrainer: boolean;
}) {
  if (isPending) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>;
  return (
    <Card className="divide-y divide-border">
      {rows.map((r) => (
        <div key={r.student_id} className="flex items-center gap-3 p-3">
          <div className="w-10 text-right tactical-heading text-primary font-black">
            {r.rank_position}º
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{r.full_name}</p>
            {showTrainer && r.trainer_name && (
              <p className="text-xs text-muted-foreground truncate">Treinador: {r.trainer_name}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-bold">{Number(r.points).toFixed(0)} pts</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Flame className="w-3 h-3" /> {r.current_streak}
            </p>
          </div>
        </div>
      ))}
    </Card>
  );
}

function TrainersList({ period }: { period: Period }) {
  const fetchTl = useServerFn(getTrainerLeaderboard);
  const { data, isPending, error } = useQuery({
    queryKey: ["leaderboard-trainers", period],
    queryFn: () => fetchTl({ data: { period } }),
    staleTime: 60_000,
  });
  if (isPending) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (error) return <p className="text-sm text-destructive">Sem permissão.</p>;
  const rows = data?.rows ?? [];
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nenhum treinador.</p>;
  return (
    <Card className="divide-y divide-border">
      {rows.map((r, i) => (
        <div key={r.trainer_id} className="flex items-center gap-3 p-3">
          <div className="w-10 text-right tactical-heading text-primary font-black">{i + 1}º</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{r.trainer_name}</p>
            <p className="text-xs text-muted-foreground">
              {r.active_students} alunos · streak médio {Number(r.avg_streak).toFixed(1)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold">{Number(r.avg_points).toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">média/aluno</p>
          </div>
        </div>
      ))}
    </Card>
  );
}
