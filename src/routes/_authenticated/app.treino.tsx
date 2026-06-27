import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/treino")({
  component: TreinoLayout,
});

function TreinoLayout() {
  const loc = useLocation();
  const isEstruturado = loc.pathname.startsWith("/app/treino/estruturado");
  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">TREINO</p>
        <div className="tactical-divider mt-2" />
      </div>
      <nav className="grid grid-cols-2 rounded-md border border-border overflow-hidden text-sm">
        <Link
          to="/app/treino"
          className={`tactical-heading text-xs py-2 text-center ${
            !isEstruturado ? "bg-primary text-primary-foreground" : "bg-card"
          }`}
        >
          PLANILHA (PDF)
        </Link>
        <Link
          to="/app/treino/estruturado"
          className={`tactical-heading text-xs py-2 text-center ${
            isEstruturado ? "bg-primary text-primary-foreground" : "bg-card"
          }`}
        >
          ESTRUTURADO
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
