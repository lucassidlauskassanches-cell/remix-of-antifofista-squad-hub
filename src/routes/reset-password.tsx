import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

async function waitForRecoverySession(attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

function getResetParams() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

  return {
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    code: searchParams.get("code") ?? hashParams.get("code"),
    tokenHash:
      searchParams.get("token_hash") ??
      hashParams.get("token_hash") ??
      searchParams.get("token") ??
      hashParams.get("token"),
    error:
      searchParams.get("error_description") ??
      hashParams.get("error_description") ??
      searchParams.get("error") ??
      hashParams.get("error"),
  };
}

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { accessToken, refreshToken, code, tokenHash, error } = getResetParams();

      if (error) {
        if (!cancelled) {
          toast.error("Link inválido ou expirado. Solicite novo e-mail.");
          setReady(true);
        }
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError && !(await waitForRecoverySession(8))) {
          if (!cancelled) {
            toast.error("Link inválido ou expirado. Solicite novo e-mail.");
            setReady(true);
          }
          return;
        }
        window.history.replaceState({}, "", "/reset-password");
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !(await waitForRecoverySession(8))) {
          if (!cancelled) {
            toast.error("Link inválido ou expirado. Solicite novo e-mail.");
            setReady(true);
          }
          return;
        }
        window.history.replaceState({}, "", "/reset-password");
      }

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (error && !(await waitForRecoverySession(8))) {
          if (!cancelled) {
            toast.error("Link inválido ou expirado. Solicite novo e-mail.");
            setReady(true);
          }
          return;
        }
        window.history.replaceState({}, "", "/reset-password");
      }

      const hasRecoverySession = await waitForRecoverySession();
      if (cancelled) return;
      if (hasRecoverySession) {
        setHasSession(true);
        setReady(true);
        return;
      }

      setReady(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setHasSession(true);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoading(false);
      toast.error(
        "Sessão de recuperação ausente. Abra novamente o link do e-mail neste mesmo navegador."
      );
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Senha atualizada.");
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="tactical-heading text-2xl">DEFINIR NOVA SENHA</h1>

        {!ready && (
          <p className="text-sm text-muted-foreground">
            Validando link de recuperação...
          </p>
        )}

        {ready && !hasSession && (
          <div className="text-sm text-destructive space-y-2">
            <p>
              Não encontramos uma sessão de recuperação ativa. Isso acontece se
              o link expirou ou foi aberto em outro navegador.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full tactical-heading"
              onClick={() => navigate({ to: "/auth" })}
            >
              VOLTAR E SOLICITAR NOVO LINK
            </Button>
          </div>
        )}

        {ready && hasSession && (
          <>
            <div>
              <Label className="tactical-heading text-xs">NOVA SENHA</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full tactical-heading bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "SALVANDO..." : "SALVAR"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
