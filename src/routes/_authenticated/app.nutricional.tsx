import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/nutricional")({
  component: NutriLayout,
});

function NutriLayout() {
  const loc = useLocation();
  const isSub = loc.pathname.includes("/nutricional/substituicoes");
  const isPdf = loc.pathname.includes("/nutricional/pdf");
  const isDieta = !isSub && !isPdf;
  const linkCls = (active: boolean) =>
    `tactical-heading text-[11px] tracking-widest pb-1 border-b-2 ${
      active
        ? "text-primary border-primary"
        : "text-muted-foreground border-transparent hover:text-foreground"
    }`;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5 border-b border-border">
        <Link to="/app/nutricional" className={linkCls(isDieta)}>
          SUGESTÃO
        </Link>
        <Link to="/app/nutricional/substituicoes" className={linkCls(isSub)}>
          SUBSTITUIÇÕES
        </Link>
        <Link to="/app/nutricional/pdf" className={linkCls(isPdf)}>
          PDF
        </Link>
      </div>
      <Outlet />
    </div>
  );
}
