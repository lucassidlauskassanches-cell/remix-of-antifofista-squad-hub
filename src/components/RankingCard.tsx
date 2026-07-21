import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Flame } from "lucide-react";
import { getLeaderboard } from "@/lib/leaderboard.functions";

type Period = "weekly" | "monthly";

function motivPhrase(pct: number | null, points: number) {
  if (points <= 0) return "Você ainda não pontuou no período — registre hoje para entrar no ranking.";
  if (pct === null) return "Continue firme na disciplina.";
  if (pct <= 10) return "ELITE DA SQUAD.";
  if (pct <= 25) return "TOP DA TROPA.";
  if (pct <= 50) return "SUBINDO NA TROPA.";
  return "MANTENHA O RITMO — CADA REGISTRO CONTA.";
}

export function RankingCard() {
  const [period, setPeriod] = useState<Period>("weekly");
  const fetchLb = useServerFn(getLeaderboard);
  const { data, isPending, error } = useQuery({
    queryKey: ["leaderboard", "self", period],
    queryFn: () => fetchLb({ data: { period } }),
    staleTime: 60_000,
  });

  const row = data?.rows?.[0];
  const total = row?.total_participants ?? 0;
  const pct = row && total > 0 && row.points > 0 ? Math.max(1, Math.round((row.rank_position / total) * 100)) : null;
  const gap = row?.points_above != null ? Math.max(0, Number(row.points_above) - Number(row.points)) : null;

  return (
    <Card className="p-4 space-y-3 bg-card border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="tactical-heading text-sm tracking-widest">RANKING</h2>
        </div>
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
      </div>

      {isPending && <p className="text-xs text-muted-foreground">Carregando ranking...</p>}
      {error && <p className="text-xs text-destructive">Erro ao carregar ranking.</p>}

      {!isPending && !error && (!row || Number(row.points) <= 0) && (
        <div className="rounded-md border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Você ainda não pontuou {period === "weekly" ? "esta semana" : "este mês"} — registre hoje para entrar no ranking.
          </p>
        </div>
      )}

      {!isPending && row && Number(row.points) > 0 && (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground tactical-heading tracking-widest">SUA POSIÇÃO</p>
              <p className="text-4xl font-black tracking-tight text-primary leading-none">
                {row.rank_position}º
                <span className="text-lg text-muted-foreground font-semibold"> de {total}</span>
              </p>
            </div>
            {pct !== null && (
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-3 py-1 text-xs tactical-heading">
                  <Medal className="w-3.5 h-3.5" /> TOP {pct}%
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Flame className="w-3.5 h-3.5" /> streak {row.current_streak}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pontos no período</span>
            <span className="font-bold">{Number(row.points).toFixed(0)}</span>
          </div>

          {gap !== null && gap > 0 && (
            <p className="text-xs text-muted-foreground">
              Faltam <span className="text-primary font-semibold">{gap.toFixed(0)}</span> pontos para o {row.rank_position - 1}º lugar.
            </p>
          )}

          <p className="tactical-heading text-xs tracking-widest text-primary">
            {motivPhrase(pct, Number(row.points))}
          </p>
        </div>
      )}
    </Card>
  );
}
