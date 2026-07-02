import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dumbbell, Apple, Video, LogOut, ShieldCheck, Users, TrendingUp, ClipboardCheck } from "lucide-react";
import { getMyContext } from "@/lib/squad.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/logo-antifofista.png.asset.json";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  const fetchCtx = useServerFn(getMyContext);
  const { data: ctx } = useSuspenseQuery({
    queryKey: ["my-context"],
    queryFn: () => fetchCtx(),
  });
  const navigate = useNavigate();
  const loc = useLocation();
  const queryClient = useQueryClient();

  async function signOut() {
    if (!confirm("Sair da sua conta?")) return;
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isAdminArea = loc.pathname.startsWith("/app/admin");

  return (
    <div className="min-h-screen flex flex-col bg-background pb-20">
      <div className="bear-layer" aria-hidden />
      <div className="bear-grain" aria-hidden />
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Antifofista Squad"
              className="h-8 w-auto object-contain"
            />
            <p className="text-sm text-foreground font-medium truncate max-w-[60vw]">
              Olá, {ctx.profile?.full_name?.split(" ")[0] || "Soldado"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {ctx.isAdmin && (
              <>
                <Button
                  asChild
                  variant={
                    loc.pathname.startsWith("/app/admin/visao")
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="tactical-heading text-xs"
                >
                  <Link to="/app/admin/visao">
                    <Users className="w-4 h-4 mr-1" /> VISÃO
                  </Link>
                </Button>
                <Button
                  asChild
                  variant={
                    loc.pathname.startsWith("/app/admin/treinadores")
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="tactical-heading text-xs"
                >
                  <Link to="/app/admin/treinadores">
                    <ShieldCheck className="w-4 h-4 mr-1" /> EQUIPE
                  </Link>
                </Button>
              </>
            )}
            {(ctx.isTreinador || ctx.isAdmin) && (
              <Button
                asChild
                variant={
                  loc.pathname.startsWith("/app/admin/alunos") ? "default" : "outline"
                }
                size="sm"
                className="tactical-heading text-xs"
              >
                <Link to="/app/admin/alunos">
                  <ShieldCheck className="w-4 h-4 mr-1" /> ALUNOS
                </Link>
              </Button>
            )}

            <Button onClick={signOut} variant="ghost" size="icon" aria-label="Sair">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 py-4">
        <Outlet />
      </main>

      {!isAdminArea && (
        <nav className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t border-border z-10">
          <div className="max-w-3xl mx-auto grid grid-cols-5">
            <TabLink to="/app/galeria" icon={<Video className="w-5 h-5" />} label="GALERIA" />
            <TabLink to="/app/treino" icon={<Dumbbell className="w-5 h-5" />} label="TREINO" />
            <TabLink to="/app/nutricional" icon={<Apple className="w-5 h-5" />} label="NUTRIÇÃO" />
            <TabLink to="/app/registro" icon={<ClipboardCheck className="w-5 h-5" />} label="REGISTRO" />
            <TabLink to="/app/logbook" icon={<TrendingUp className="w-5 h-5" />} label="EVOLUÇÃO" />
          </div>
        </nav>
      )}
    </div>
  );
}

function TabLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1 py-3 text-muted-foreground hover:text-primary"
      activeProps={{ className: "flex flex-col items-center gap-1 py-3 text-primary" }}
    >
      {icon}
      <span className="tactical-heading text-[10px] tracking-widest">{label}</span>
    </Link>
  );
}
