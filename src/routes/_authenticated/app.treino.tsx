import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMyTraining } from "@/lib/squad.functions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/treino")({
  component: TreinoPage,
});

function TreinoPage() {
  const fetchTraining = useServerFn(getMyTraining);
  const { data } = useSuspenseQuery({
    queryKey: ["my-training"],
    queryFn: () => fetchTraining(),
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  if (!data.plan) {
    return (
      <EmptyState text="Nenhum treino ativo ainda. Aguarde seu treinador liberar." />
    );
  }
  const groups: Record<string, typeof data.exercises> = {};
  for (const ex of data.exercises) {
    const key = ex.day_label || "TREINO";
    groups[key] = groups[key] || [];
    groups[key].push(ex);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          PLANO ATIVO
        </p>
        <h1 className="tactical-heading text-2xl">{data.plan.title || "Treino"}</h1>
        <div className="tactical-divider mt-2" />
      </div>

      <Accordion type="multiple" defaultValue={Object.keys(groups)}>
        {Object.entries(groups).map(([day, items]) => (
          <AccordionItem key={day} value={day} className="border-border">
            <AccordionTrigger className="tactical-heading text-left">
              {day}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {items.map((ex) => (
                  <Card key={ex.id} className="p-3 bg-card border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          {ex.exercise_name}
                        </h3>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {ex.sets && <span>{ex.sets} séries</span>}
                          {ex.reps && <span>{ex.reps} reps</span>}
                          {ex.load && <span>Carga: {ex.load}</span>}
                          {ex.rest && <span>Descanso: {ex.rest}</span>}
                        </div>
                        {ex.notes && (
                          <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">
                            {ex.notes}
                          </p>
                        )}
                      </div>
                      {ex.gallery?.youtube_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setVideoUrl(ex.gallery!.youtube_url)}
                          className="tactical-heading text-xs"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          VÍDEO
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Dialog open={!!videoUrl} onOpenChange={(o) => !o && setVideoUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="tactical-heading">EXECUÇÃO</DialogTitle>
          </DialogHeader>
          {videoUrl && <YouTubePlayer url={videoUrl} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function YouTubePlayer({ url }: { url: string }) {
  const id = extractYouTubeId(url);
  if (!id) return <p>Vídeo inválido</p>;
  return (
    <div className="aspect-video w-full">
      <iframe
        className="w-full h-full rounded-md"
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="Vídeo do exercício"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    const v = u.searchParams.get("v");
    if (v) return v;
    const parts = u.pathname.split("/");
    const i = parts.findIndex((p) => p === "embed" || p === "shorts");
    if (i >= 0) return parts[i + 1] ?? null;
    return null;
  } catch {
    return null;
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p>{text}</p>
    </div>
  );
}
