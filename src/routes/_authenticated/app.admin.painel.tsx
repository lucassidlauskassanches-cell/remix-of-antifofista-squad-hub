import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTrainerPanel } from "@/lib/crm.functions";
import { STATUS_LABEL } from "@/lib/crm-config";
import type { AlertKey } from "@/lib/crm-alerts";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/painel")({
  component: PainelTreinador,
  head: () => ({
    meta: [
      { title: "Painel do Treinador | Antifofista Squad" },
      {
        name: "description",
        content:
          "Cockpit do treinador: quem precisa de atenção agora, check-ins pendentes, alunos sumidos e renovações.",
      },
      { property: "og:title", content: "Painel do Treinador | Antifofista Squad" },
      {
        property: "og:description",
        content: "Alertas automáticos e manual de bordo dos seus alunos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type FilterKey = "todos" | AlertKey;

const FILTROS: { key: FilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sumido", label: "Sumidos" },
  { key: "checkin_vencido", label: "Check-in vencido" },
  { key: "feedback_antigo", label: "Feedback antigo" },
  { key: "adesao_queda", label: "Adesão em queda" },
  { key: "renovacao", label: "Renovação próxima" },
  { key: "plano_a_montar", label: "Plano a montar" },
];

function diasAtras(iso: string | null, today: string) {
  if (!iso) return null;
  const a = Date.parse(`${iso}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function PainelTreinador() {
  const fetchPanel = useServerFn(getTrainerPanel);
  const { data, isPending, error } = useQuery({
    queryKey: ["trainer-panel"],
    queryFn: () => fetchPanel(),
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [trainerFilter, setTrainerFilter] = useState<string>("all");

  const allRows = data?.rows ?? [];
  const today = data?.today ?? "";
  const isAdmin = data?.isAdmin ?? false;
  const trainers = data?.trainers ?? [];

  const rows = useMemo(
    () =>
      trainerFilter === "all"
        ? allRows
        : trainerFilter === "none"
          ? allRows.filter((r) => !r.trainer_id)
          : allRows.filter((r) => r.trainer_id === trainerFilter),
    [allRows, trainerFilter],
  );

  const countsOf = (list: typeof allRows) => {
    const has = (k: AlertKey) => list.filter((r) => r.alerts.some((a) => a.key === k)).length;
    return {
      total: list.length,
      responder: list.filter(
        (r) => r.status === "aguardando_resposta" || r.lastCheckin?.status === "recebido",
      ).length,
      checkin: has("checkin_vencido"),
      sumidos: has("sumido"),
      renovacao: has("renovacao") + has("renovacao_vencida"),
      plano: has("plano_a_montar"),
    };
  };

  const counts = useMemo(() => countsOf(rows), [rows]);

  const trainerSummary = useMemo(() => {
    if (!isAdmin) return [];
    const groups = trainers.map((t) => ({
      id: t.id,
      full_name: t.full_name,
      ...countsOf(allRows.filter((r) => r.trainer_id === t.id)),
    }));
    const orphans = allRows.filter((r) => !r.trainer_id);
    if (orphans.length) {
      groups.push({ id: "none", full_name: "Sem treinador", ...countsOf(orphans) });
    }
    return groups.sort(
      (a, b) =>
        b.responder + b.checkin + b.sumidos + b.renovacao -
        (a.responder + a.checkin + a.sumidos + a.renovacao),
    );
  }, [allRows, trainers, isAdmin]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.full_name} ${r.email}`.toLowerCase().includes(q)) return false;
      if (filter === "todos") return true;
      if (filter === "renovacao")
        return r.alerts.some(
          (a) => a.key === "renovacao" || a.key === "renovacao_vencida",
        );
      return r.alerts.some((a) => a.key === filter);
    });
  }, [rows, search, filter]);

  if (isPending) return <p className="text-sm text-muted-foreground">Carregando painel...</p>;
  if (error)
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar o painel. Tente novamente.
      </p>
    );


  return (
    <div className="space-y-4">
      <div>
        <h1 className="tactical-heading text-2xl">PAINEL</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? trainerFilter === "all"
              ? "Visão consolidada de todos os treinadores."
              : `Visão do treinador: ${
                  trainerFilter === "none"
                    ? "Sem treinador"
                    : (trainers.find((t) => t.id === trainerFilter)?.full_name ?? "")
                }`
            : "Quem precisa de mim agora."}
        </p>
      </div>

      {isAdmin && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setTrainerFilter("all")}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                trainerFilter === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos os treinadores
            </button>
            {trainerSummary.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrainerFilter(t.id)}
                className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                  trainerFilter === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.full_name}
              </button>
            ))}
          </div>

          <Card className="p-3 space-y-2">
            <p className="text-[10px] tracking-wider text-muted-foreground">
              RESUMO POR TREINADOR
            </p>
            {trainerSummary.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum treinador com alunos.</p>
            )}
            {trainerSummary.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrainerFilter(t.id)}
                className="w-full text-left rounded-md border border-border px-2 py-2 hover:border-primary/60 transition-colors"
              >
                <p className="text-sm font-semibold text-foreground truncate">
                  {t.full_name}{" "}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    · {t.total} aluno(s)
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  A responder {t.responder} · Check-in vencido {t.checkin} · Sumidos{" "}
                  {t.sumidos} · Renovação {t.renovacao}
                </p>
              </button>
            ))}
          </Card>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <CountCard label="A RESPONDER" value={counts.responder} />
        <CountCard label="CHECK-IN VENCIDO" value={counts.checkin} />
        <CountCard label="SUMIDOS" value={counts.sumidos} />
        <CountCard label="RENOVAÇÃO" value={counts.renovacao} />
        <CountCard label="PLANO A MONTAR" value={counts.plano} />
      </div>


      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar aluno por nome ou e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum aluno neste filtro.</p>
        )}
        {visible.map((r) => {
          const dias = diasAtras(r.lastActivity, today);
          return (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/app/admin/alunos/$id"
                  params={{ id: r.id }}
                  className="min-w-0 flex-1"
                >
                  <p className="text-sm font-semibold text-foreground truncate">
                    {r.full_name}
                  </p>
                  {isAdmin && (
                    <p className="text-[11px] text-primary/80 truncate">
                      Treinador: {r.trainer_name ?? "sem treinador"}
                    </p>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    {STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? r.status} ·{" "}
                    {dias === null
                      ? "sem registros"
                      : dias === 0
                        ? "ativo hoje"
                        : `há ${dias} d`}
                    {r.adesao7 !== null ? ` · adesão ${Math.round(r.adesao7)}%` : ""}
                  </p>
                  {r.nextReminder && (
                    <p className="text-[11px] text-muted-foreground">
                      Próxima ação: {r.nextReminder.texto}
                    </p>
                  )}
                </Link>
                {r.whatsapp_grupo_url && (
                  <Button asChild size="sm" variant="outline" className="text-xs shrink-0">
                    <a
                      href={r.whatsapp_grupo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                )}
              </div>
              {r.alerts.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.alerts.slice(0, 3).map((a) => (
                    <span
                      key={a.key}
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${
                        a.tone === "danger"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : a.tone === "warn"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" /> {a.label}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl tactical-heading text-primary">{value}</p>
    </Card>
  );
}
