import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dumbbell, Apple, Video, LogOut, ShieldCheck, Users, TrendingUp } from "lucide-react";
import { getMyContext } from "@/lib/squad.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/logo-antifofista.png.asset.json";

function BearIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Orelhas */}
      <circle cx="7" cy="6" r="2.2" />
      <circle cx="17" cy="6" r="2.2" />
      {/* Cabeça */}
      <path d="M5.5 11c0-3.5 2.8-6.5 6.5-6.5s6.5 3 6.5 6.5c0 1.5-.5 3-1.5 4" />
      <path d="M5.5 11c-1.8 0-3.3 1.2-3.8 3-.2.8-.2 1.7 0 2.5.5 1.8 2 3 3.8 3" />
      <path d="M18.5 11c1.8 0 3.3 1.2 3.8 3 .2.8.2 1.7 0 2.5-.5 1.8-2 3-3.8 3" />
      {/* Focinho */}
      <ellipse cx="12" cy="14.5" rx="3" ry="2.2" />
      {/* Olhos */}
      <circle cx="9.5" cy="11" r=".9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="11" r=".9" fill="currentColor" stroke="none" />
      {/* Nariz */}
      <path d="M11 15.5h2" />
    </svg>
  );
}

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
            <TabLink
              to="/app/registro"
              isActive={loc.pathname.startsWith("/app/registro")}
              icon={
                <BearIcon isActive={loc.pathname.startsWith("/app/registro")} />
              }
              label="ANTIFOFISTA"
            />
            <TabLink to="/app/treino" isActive={loc.pathname.startsWith("/app/treino")} icon={<Dumbbell className="w-5 h-5" />} label="TREINO" />
            <TabLink to="/app/nutricional" isActive={loc.pathname.startsWith("/app/nutricional")} icon={<Apple className="w-5 h-5" />} label="NUTRIÇÃO" />
            <TabLink to="/app/logbook" isActive={loc.pathname.startsWith("/app/logbook")} icon={<TrendingUp className="w-5 h-5" />} label="PROGRESSÃO" />
            <TabLink to="/app/galeria" isActive={loc.pathname.startsWith("/app/galeria")} icon={<Video className="w-5 h-5" />} label="GALERIA" />
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
  isActive,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 py-3 transition-colors ${
        isActive ? "text-primary" : "text-white hover:text-white/80"
      }`}
    >
      {icon}
      <span className="tactical-heading text-[10px] tracking-widest">{label}</span>
    </Link>
  );
}
