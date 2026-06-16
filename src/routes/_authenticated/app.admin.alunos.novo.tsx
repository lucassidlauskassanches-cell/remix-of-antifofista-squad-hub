import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createStudent } from "@/lib/squad.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin/alunos/novo")({
  component: NovoAluno,
});

function NovoAluno() {
  const create = useServerFn(createStudent);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await create({ data: form });
      toast.success("Aluno cadastrado");
      navigate({ to: "/app/admin/alunos" });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="tactical-heading text-2xl mb-4">NOVO ALUNO</h1>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label className="tactical-heading text-xs">NOME COMPLETO</Label>
          <Input
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="tactical-heading text-xs">E-MAIL</Label>
          <Input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <Label className="tactical-heading text-xs">SENHA INICIAL</Label>
          <Input
            required
            type="text"
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div>
          <Label className="tactical-heading text-xs">TELEFONE (opcional)</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full tactical-heading bg-primary text-primary-foreground"
        >
          {loading ? "CRIANDO..." : "CADASTRAR ALUNO"}
        </Button>
      </form>
    </div>
  );
}
