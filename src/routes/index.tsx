import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Antifofista Squad — Seu acompanhamento" },
    { name: "description", content: "Acompanhe seus treinos, nutrição e disciplina no Antifofista Squad." },
    { property: "og:title", content: "Antifofista Squad — Seu acompanhamento" },
    { property: "og:description", content: "Seu acompanhamento de treino, nutrição e disciplina." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
});
