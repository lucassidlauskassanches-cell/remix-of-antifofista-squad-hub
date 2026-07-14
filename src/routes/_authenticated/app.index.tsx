import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/squad.functions";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppIndex,
});

function AppIndex() {
  const fetchContext = useServerFn(getMyContext);
  const { data: ctx } = useQuery({
    queryKey: ["my-context"],
    queryFn: () => fetchContext(),
    retry: 2,
  });

  if (!ctx) return null;
  if (ctx.isAdmin) return <Navigate to="/app/admin/visao" replace />;
  if (ctx.isTreinador) return <Navigate to="/app/admin/alunos" replace />;
  return <Navigate to="/app/treino" replace />;
}
