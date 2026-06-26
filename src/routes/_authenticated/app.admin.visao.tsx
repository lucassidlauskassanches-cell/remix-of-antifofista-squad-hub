import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminOverview } from "@/lib/squad.functions";
import { Card } from "@/components/ui/card";
import { Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/visao")({
  component: VisaoGeral,
  errorComponent: ({ error }) => (
    <p className="text-destructive">{error.message}</p>
  ),
});

function VisaoGeral() {
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          PAINEL DO ADMIN
        </p>
        <h1 className="tactical-heading text-2xl flex items-center gap-2">
          <Users className="w-6 h-6" /> VISÃO GERAL
        </h1>
        {data && (
          <p className="text-xs text-muted-foreground mt-1">
            {data.totalStudents} aluno(s) no total
          </p>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      {data?.trainers.map(({ trainer, students }) => (
        <Card key={trainer.id} className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <div className="flex-1">
              <p className="tactical-heading text-sm">
                {trainer.full_name || "(sem nome)"}
              </p>
              <p className="text-xs text-muted-foreground">{trainer.email}</p>
            </div>
            <span className="tactical-heading text-xs text-primary">
              {students.length}
            </span>
          </div>
          {students.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem alunos vinculados.
            </p>
          ) : (
            <ul className="space-y-1">
              {students.map((s: any) => (
                <li key={s.id}>
                  <Link
                    to="/app/admin/alunos/$id"
                    params={{ id: s.id }}
                    className="flex items-center justify-between text-sm py-1 hover:text-primary"
                  >
                    <span>{s.full_name || s.email}</span>
                    {!s.active && (
                      <span className="text-xs text-destructive tactical-heading">
                        INATIVO
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      {data && data.unassigned.length > 0 && (
        <Card className="p-4 space-y-2 border-dashed">
          <p className="tactical-heading text-sm text-muted-foreground">
            SEM TREINADOR ({data.unassigned.length})
          </p>
          <ul className="space-y-1">
            {data.unassigned.map((s: any) => (
              <li key={s.id}>
                <Link
                  to="/app/admin/alunos/$id"
                  params={{ id: s.id }}
                  className="text-sm py-1 block hover:text-primary"
                >
                  {s.full_name || s.email}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
