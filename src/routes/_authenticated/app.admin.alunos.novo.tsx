import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  createStudent,
  getMyContext,
  listTrainers,
} from "@/lib/squad.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin/alunos/novo")({
  component: NovoAluno,
});

function NovoAluno() {
  const create = useServerFn(createStudent);
  const fetchCtx = useServerFn(getMyContext);
  const fetchTrainers = useServerFn(listTrainers);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: ctx } = useQuery({
    queryKey: ["my-context"],
    queryFn: () => fetchCtx(),
  });
  const { data: trainersData } = useQuery({
    queryKey: ["trainers"],
    queryFn: () => fetchTrainers(),
    enabled: !!ctx?.isAdmin,
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    trainer_id: "" as string,
  });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await create({
        data: {
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          trainer_id:
            ctx?.isAdmin && form.trainer_id ? form.trainer_id : undefined,
        },
      });
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
            type="password"
            autoComplete="new-password"
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
        {ctx?.isAdmin && (
          <div>
            <Label className="tactical-heading text-xs">TREINADOR</Label>
            <Select
              value={form.trainer_id}
              onValueChange={(v) => setForm({ ...form, trainer_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um treinador" />
              </SelectTrigger>
              <SelectContent>
                {(trainersData?.rows ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name || t.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
