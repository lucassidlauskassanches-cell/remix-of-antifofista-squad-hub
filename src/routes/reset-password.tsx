import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
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
        <div>
          <Label className="tactical-heading text-xs">NOVA SENHA</Label>
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full tactical-heading bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {loading ? "SALVANDO..." : "SALVAR"}
        </Button>
      </form>
    </div>
  );
}
