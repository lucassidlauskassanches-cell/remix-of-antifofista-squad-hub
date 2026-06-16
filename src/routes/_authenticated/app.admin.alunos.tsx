import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listStudents } from "@/lib/squad.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Video, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/alunos")({
  component: AlunosList,
});

function AlunosList() {
  const fetch = useServerFn(listStudents);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["students", search, page],
    queryFn: () => fetch({ data: { search, page, pageSize } }),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="tactical-heading text-xs text-primary tracking-widest">
            PAINEL DO TREINADOR
          </p>
          <h1 className="tactical-heading text-2xl">ALUNOS</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/app/admin/galeria">
            <Button variant="outline" className="tactical-heading text-xs">
              <Video className="w-4 h-4 mr-1" /> GALERIA
            </Button>
          </Link>
          <Link to="/app/admin/alunos/novo">
            <Button className="tactical-heading text-xs bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-1" /> NOVO
            </Button>
          </Link>
        </div>
      </div>

      <Input
        placeholder="Buscar por nome ou e-mail..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="space-y-2">
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {data?.rows.map((s) => (
          <Link
            key={s.id}
            to="/app/admin/alunos/$id"
            params={{ id: s.id }}
            className="block"
          >
            <Card className="p-3 hover:border-primary transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.full_name || "(sem nome)"}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </div>
                {!s.active && (
                  <span className="text-xs text-destructive tactical-heading">
                    INATIVO
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
        {data && data.rows.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum aluno encontrado.
          </p>
        )}
      </div>

      {data && data.total > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
