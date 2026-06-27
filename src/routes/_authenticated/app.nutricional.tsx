import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/nutricional")({
  component: NutriLayout,
});

function NutriLayout() {
  const loc = useLocation();
  const isSub = loc.pathname.includes("/nutricional/substituicoes");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 p-1 bg-card rounded-md border border-border">
        <Link
          to="/app/nutricional"
          className={`tactical-heading text-xs text-center py-2 rounded ${
            !isSub ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          PLANO
        </Link>
        <Link
          to="/app/nutricional/substituicoes"
          className={`tactical-heading text-xs text-center py-2 rounded ${
            isSub ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          SUBSTITUIÇÕES
        </Link>
      </div>
      <Outlet />
    </div>
  );
}
