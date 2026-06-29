import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listGallery } from "@/lib/squad.functions";
import { Input } from "@/components/ui/input";
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
    <div>
      <div className="af-eyebrow">Execução dos exercícios</div>
      <div className="af-title">Galeria</div>

      <div className="flex gap-2 mt-3 mb-3">
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

      <div className="space-y-2.5">
        {filtered.map((it) => {
          const id = extractYouTubeId(it.youtube_url);
          return (
            <div
              key={it.id}
              className="af-vid cursor-pointer"
              onClick={() => setOpen({ url: it.youtube_url, title: it.title })}
            >
              <div className="thumb aspect-video !h-auto overflow-hidden">
                {id && (
                  <img
                    src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                    alt={it.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div className="pl relative z-[1]">
                  <Play className="w-[18px] h-[18px]" fill="currentColor" />
                </div>
              </div>
              <div className="cap2">
                {it.muscle_group && (
                  <span className="af-eyebrow block mb-0.5">{it.muscle_group}</span>
                )}
                {it.title}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
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
