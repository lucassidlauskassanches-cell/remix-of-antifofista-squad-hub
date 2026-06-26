import { createFileRoute, redirect } from "@tanstack/react-router";
import { getMyContext } from "@/lib/squad.functions";

export const Route = createFileRoute("/_authenticated/app/")({
  loader: async () => {
    const ctx = await getMyContext();
    if (ctx.isAdmin) throw redirect({ to: "/app/admin/treinadores" });
    if (ctx.isTreinador) throw redirect({ to: "/app/admin/alunos" });
    throw redirect({ to: "/app/treino" });
  },
});
