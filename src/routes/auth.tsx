import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Falha no login: " + error.message);
      return;
    }
    navigate({ to: "/app", replace: true });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Enviamos um e-mail com instruções.");
    setMode("login");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-md bg-primary/10 flex items-center justify-center border border-primary/30">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="tactical-heading text-3xl mt-4 text-foreground">
            ANTIFOFISTA
          </h1>
          <p className="tactical-heading text-sm text-primary tracking-[0.3em]">
            S Q U A D
          </p>
          <div className="tactical-divider w-full mt-4" />
        </div>

        <form
          onSubmit={mode === "login" ? handleLogin : handleForgot}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="email" className="tactical-heading text-xs">
              E-MAIL
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 bg-input border-border"
            />
          </div>
          {mode === "login" && (
            <div>
              <Label htmlFor="password" className="tactical-heading text-xs">
                SENHA
              </Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 bg-input border-border"
              />
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full tactical-heading bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading
              ? "AGUARDE..."
              : mode === "login"
                ? "ENTRAR NO SQUAD"
                : "ENVIAR INSTRUÇÕES"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Esqueci minha senha
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              ← Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
