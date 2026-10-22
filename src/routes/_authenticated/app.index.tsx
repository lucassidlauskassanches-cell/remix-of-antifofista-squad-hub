import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/access.functions";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [
    { title: "Minha Área — Antifofista Squad" },
    { name: "description", content: "Seu acompanhamento no Antifofista Squad." },
    { property: "og:title", content: "Minha Área — Antifofista Squad" },
    { property: "og:description", content: "Seu acompanhamento no Antifofista Squad." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
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
  if (ctx.isAdmin) return <Navigate to="/app/admin/painel" replace />;
  if (ctx.isTreinador) return <Navigate to="/app/admin/painel" replace />;
  return <Navigate to="/app/treino" replace />;
}
