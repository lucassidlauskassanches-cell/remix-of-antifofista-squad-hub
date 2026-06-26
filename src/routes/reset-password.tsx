import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resetPasswordWithRecoveryProof } from "@/lib/password-reset.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type RecoveryProof = {
  tokenHash?: string;
  token?: string;
  email?: string;
};

async function waitForRecoverySession(attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
}

function getResetParams(href = window.location.href) {
  const url = new URL(href);
  const searchParams = url.searchParams;
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const type = searchParams.get("type") ?? hashParams.get("type");
  const token = searchParams.get("token") ?? hashParams.get("token");
  const email = searchParams.get("email") ?? hashParams.get("email");

  return {
    accessToken: searchParams.get("access_token") ?? hashParams.get("access_token"),
    refreshToken:
      searchParams.get("refresh_token") ?? hashParams.get("refresh_token"),
    code: searchParams.get("code") ?? hashParams.get("code"),
    tokenHash:
      searchParams.get("token_hash") ??
      hashParams.get("token_hash") ??
      (type === "recovery" && token && !email ? token : null),
    token,
    email,
    type,
    error:
      searchParams.get("error_description") ??
      hashParams.get("error_description") ??
      searchParams.get("error") ??
      hashParams.get("error"),
  };
}

async function persistReturnedSession(session?: {
  access_token: string;
  refresh_token: string;
} | null) {
  if (!session?.access_token || !session.refresh_token) return false;

  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return !error || Boolean(await waitForRecoverySession(8));
}

async function updatePasswordWithAccessToken(accessToken: string, password: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Configuração de autenticação indisponível.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.msg ?? body?.message ?? "Não foi possível atualizar a senha.",
    );
  }
}

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const resetWithProof = useServerFn(resetPasswordWithRecoveryProof);
  const [initialHref] = useState(() => window.location.href);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [recoveryProof, setRecoveryProof] = useState<RecoveryProof | null>(null);
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { accessToken, refreshToken, code, tokenHash, token, email, error } =
        getResetParams(initialHref);
      let resolvedAccessToken: string | null = null;

      if (error) {
        if (!cancelled) {
          toast.error("Link inválido ou expirado. Solicite novo e-mail.");
          setReady(true);
        }
        return;
      }

      if (accessToken && refreshToken) {
        resolvedAccessToken = accessToken;
        if (!cancelled) setRecoveryAccessToken(accessToken);
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (
          sessionError &&
          !resolvedAccessToken &&
          !(await waitForRecoverySession(8))
        ) {
          if (!cancelled) {
            toast.error("Link inválido ou expirado. Solicite novo e-mail.");
            setReady(true);
          }
          return;
        }
        window.history.replaceState({}, "", "/reset-password");
      }

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (data.session?.access_token && !cancelled) {
          resolvedAccessToken = data.session.access_token;
          setRecoveryAccessToken(data.session.access_token);
        }
        const sessionPersisted = await persistReturnedSession(data.session);
        if (error && !sessionPersisted && !(await waitForRecoverySession(8))) {
          if (!cancelled) {
            toast.error("Link inválido ou expirado. Solicite novo e-mail.");
            setReady(true);
          }
          return;
        }
        window.history.replaceState({}, "", "/reset-password");
      }

      if (tokenHash) {
        if (!cancelled) setRecoveryProof({ tokenHash });
        window.history.replaceState({}, "", "/reset-password");
      }

      if (token && email && !tokenHash) {
        if (!cancelled) setRecoveryProof({ token, email });
        window.history.replaceState({}, "", "/reset-password");
      }

      const recoverySession = await waitForRecoverySession();
      if (cancelled) return;
      const usableAccessToken = recoverySession?.access_token ?? resolvedAccessToken;
      if (usableAccessToken) {
        setRecoveryAccessToken(usableAccessToken);
        setHasSession(true);
        setReady(true);
        return;
      }

      if (tokenHash || (token && email)) {
        setHasSession(true);
        setReady(true);
        return;
      }

      setReady(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        if (session?.access_token) setRecoveryAccessToken(session.access_token);
        setHasSession(true);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [initialHref]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? recoveryAccessToken;
    if (!accessToken && !recoveryProof) {
      setLoading(false);
      toast.error(
        "Sessão de recuperação ausente. Abra novamente o link do e-mail neste mesmo navegador."
      );
      return;
    }

    try {
      if (accessToken && sessionData.session) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) await updatePasswordWithAccessToken(accessToken, password);
      } else if (accessToken) {
        await updatePasswordWithAccessToken(accessToken, password);
      } else if (recoveryProof) {
        await resetWithProof({ data: { ...recoveryProof, password } });
      }
      toast.success("Senha atualizada. Entre com a nova senha.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(
        "Erro: " + (error instanceof Error ? error.message : "falha ao salvar"),
      );
    } finally {
      setLoading(false);
    }
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
