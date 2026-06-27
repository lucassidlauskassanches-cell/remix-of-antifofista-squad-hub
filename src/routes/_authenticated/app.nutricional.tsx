import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/nutricional")({
  component: NutriLayout,
});

function NutriLayout() {
  const loc = useLocation();
  const isSub = loc.pathname.includes("/nutricional/substituicoes");
  const isDieta = loc.pathname.includes("/nutricional/dieta");
  const isPlano = !isSub && !isDieta;
  const tabCls = (active: boolean) =>
    `tactical-heading text-xs text-center py-2 rounded ${
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
    }`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 p-1 bg-card rounded-md border border-border">
        <Link to="/app/nutricional" className={tabCls(isPlano)}>
          PLANO
        </Link>
        <Link to="/app/nutricional/dieta" className={tabCls(isDieta)}>
          DIETA
        </Link>
        <Link to="/app/nutricional/substituicoes" className={tabCls(isSub)}>
          SUBSTITUIÇÕES
        </Link>
      </div>
      <Outlet />
    </div>
  );
}
