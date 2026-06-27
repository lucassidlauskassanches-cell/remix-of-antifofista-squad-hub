import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listGallery } from "@/lib/squad.functions";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { YouTubePlayer, extractYouTubeId } from "@/lib/youtube";
import { Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/galeria")({
  component: GaleriaPage,
});

function GaleriaPage() {
  const fetchGallery = useServerFn(listGallery);
  const { data } = useSuspenseQuery({
    queryKey: ["gallery"],
    queryFn: () => fetchGallery(),
  });

  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [open, setOpen] = useState<{ url: string; title: string } | null>(null);

  const groups = useMemo(() => {
    const set = new Set<string>();
    data.items.forEach((i) => i.muscle_group && set.add(i.muscle_group));
    return Array.from(set).sort();
  }, [data.items]);

  const filtered = data.items.filter((it) => {
    const matchG = group === "all" || it.muscle_group === group;
    const matchS = !search || it.title.toLowerCase().includes(search.toLowerCase());
    return matchG && matchS;
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          BIBLIOTECA
        </p>
        <h1 className="tactical-heading text-2xl">GALERIA DE EXERCÍCIOS</h1>
        <div className="tactical-divider mt-2" />
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Buscar exercício..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos grupos</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filtered.map((it) => {
          const id = extractYouTubeId(it.youtube_url);
          return (
            <Card
              key={it.id}
              onClick={() => setOpen({ url: it.youtube_url, title: it.title })}
              className="overflow-hidden cursor-pointer hover:border-primary transition-colors"
            >
              <div className="relative aspect-video bg-muted">
                {id && (
                  <img
                    src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                    alt={it.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="p-2">
                <p className="text-xs tactical-heading text-primary">
                  {it.muscle_group}
                </p>
                <p className="text-sm font-medium line-clamp-2">{it.title}</p>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-2 text-center text-muted-foreground py-8">
            Nenhum vídeo encontrado.
          </p>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="tactical-heading">{open?.title}</DialogTitle>
          </DialogHeader>
          {open && <YouTubePlayer url={open.url} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
