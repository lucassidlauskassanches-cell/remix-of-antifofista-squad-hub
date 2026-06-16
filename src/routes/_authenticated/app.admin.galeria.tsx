import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listGallery,
  saveGalleryItem,
  deleteGalleryItem,
} from "@/lib/squad.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/galeria")({
  component: GaleriaAdmin,
});

function GaleriaAdmin() {
  const fetchG = useServerFn(listGallery);
  const save = useServerFn(saveGalleryItem);
  const del = useServerFn(deleteGalleryItem);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => fetchG(),
  });
  const [form, setForm] = useState({
    title: "",
    muscle_group: "",
    youtube_url: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await save({ data: form });
      toast.success("Vídeo adicionado");
      setForm({ title: "", muscle_group: "", youtube_url: "", description: "" });
      qc.invalidateQueries({ queryKey: ["gallery"] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir vídeo?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["gallery"] });
  }

  return (
    <div className="space-y-4">
      <Link
        to="/app/admin/alunos"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Link>
      <h1 className="tactical-heading text-2xl">GALERIA DE VÍDEOS</h1>

      <Card className="p-3">
        <form onSubmit={submit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="tactical-heading text-xs">TÍTULO</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label className="tactical-heading text-xs">GRUPO MUSCULAR</Label>
              <Input
                value={form.muscle_group}
                onChange={(e) =>
                  setForm({ ...form, muscle_group: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <Label className="tactical-heading text-xs">URL YOUTUBE</Label>
            <Input
              required
              type="url"
              value={form.youtube_url}
              onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
            />
          </div>
          <div>
            <Label className="tactical-heading text-xs">DESCRIÇÃO</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full tactical-heading bg-primary text-primary-foreground"
          >
            {loading ? "SALVANDO..." : "ADICIONAR VÍDEO"}
          </Button>
        </form>
      </Card>

      <div className="space-y-2">
        {data?.items.map((it) => (
          <Card key={it.id} className="p-3 flex justify-between items-start gap-2">
            <div className="flex-1">
              <p className="font-medium">{it.title}</p>
              <p className="text-xs text-muted-foreground">
                {it.muscle_group} · {it.youtube_url}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDelete(it.id)}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
