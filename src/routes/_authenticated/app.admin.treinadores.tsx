import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listTrainers,
  createTrainer,
  removeTrainer,
  updateTrainerAccount,
} from "@/lib/squad.functions";
import { getMyContext } from "@/lib/access.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, ShieldCheck, KeyRound, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin/treinadores")({
  component: TrainersPage,
  errorComponent: ({ error }) => (
    <p className="text-destructive">{error.message}</p>
  ),
});

function TrainersPage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const fetchList = useServerFn(listTrainers);
  const create = useServerFn(createTrainer);
  const remove = useServerFn(removeTrainer);
  const updateAccount = useServerFn(updateTrainerAccount);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ full_name: "", email: "", phone: "", password: "" });

  const { data: ctx } = useQuery({
    queryKey: ["my-context"],
    queryFn: () => fetchCtx(),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["trainers"],
    queryFn: () => fetchList(),
    enabled: !!ctx?.isAdmin,
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
  });

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Treinador adicionado");
      setForm({ full_name: "", email: "", password: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["trainers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar"),
  });

  const updateMut = useMutation({
    mutationFn: (userId: string) =>
      updateAccount({
        data: {
          userId,
          full_name: edit.full_name || undefined,
          email: edit.email || undefined,
          phone: edit.phone,
          password: edit.password || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Dados do treinador atualizados");
      setEditing(null);
      setEdit({ full_name: "", email: "", phone: "", password: "" });
      qc.invalidateQueries({ queryKey: ["trainers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao atualizar"),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => remove({ data: { userId } }),
    onSuccess: () => {
      toast.success("Treinador removido");
      qc.invalidateQueries({ queryKey: ["trainers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  if (ctx && !ctx.isAdmin) {
    return (
      <p className="text-destructive">Acesso restrito a administradores.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          PAINEL DO ADMIN
        </p>
        <h1 className="tactical-heading text-2xl flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> TREINADORES
        </h1>
      </div>

      <Card className="p-4 space-y-3">
        <p className="tactical-heading text-sm">NOVO TREINADOR</p>
        <Input
          placeholder="Nome completo"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <Input
          type="email"
          placeholder="E-mail"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          type="password"
          placeholder="Senha (mín. 6)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Input
          placeholder="Telefone (opcional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Button
          className="tactical-heading w-full"
          disabled={
            createMut.isPending ||
            !form.full_name ||
            !form.email ||
            form.password.length < 6
          }
          onClick={() => createMut.mutate()}
        >
          <Plus className="w-4 h-4 mr-1" />
          {createMut.isPending ? "ADICIONANDO..." : "ADICIONAR"}
        </Button>
      </Card>

      <div className="space-y-2">
        <p className="tactical-heading text-sm text-muted-foreground">
          EQUIPE ATUAL
        </p>
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {data?.rows.map((t: any) => (
          <Card key={t.id} className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t.full_name || "(sem nome)"}</p>
                <p className="text-xs text-muted-foreground">{t.email}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Editar acesso"
                  onClick={() => {
                    if (editing === t.id) {
                      setEditing(null);
                      return;
                    }
                    setEditing(t.id);
                    setEdit({
                      full_name: t.full_name ?? "",
                      email: t.email ?? "",
                      phone: t.phone ?? "",
                      password: "",
                    });
                  }}
                >
                  <KeyRound className="w-4 h-4" />
                </Button>
                {t.id !== ctx?.userId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Remover ${t.full_name || t.email} da equipe?`))
                        removeMut.mutate(t.id);
                    }}
                    aria-label="Remover"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>

            {editing === t.id && (
              <div className="space-y-2 border-t border-border pt-3">
                <Input
                  placeholder="Nome completo"
                  value={edit.full_name}
                  onChange={(e) => setEdit({ ...edit, full_name: e.target.value })}
                />
                <Input
                  type="email"
                  placeholder="E-mail de login"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
                <Input
                  placeholder="Telefone (opcional)"
                  value={edit.phone}
                  onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                />
                <Input
                  type="password"
                  placeholder="Nova senha (deixe vazio para manter)"
                  autoComplete="new-password"
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                />
                <Button
                  className="tactical-heading w-full"
                  disabled={
                    updateMut.isPending ||
                    (!!edit.password && edit.password.length < 6)
                  }
                  onClick={() => updateMut.mutate(t.id)}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {updateMut.isPending ? "SALVANDO..." : "SALVAR ACESSO"}
                </Button>
              </div>
            )}
          </Card>
        ))}
        {data && data.rows.length === 0 && (
          <p className="text-center text-muted-foreground py-6">
            Nenhum treinador cadastrado.
          </p>
        )}
      </div>
    </div>
  );
}
