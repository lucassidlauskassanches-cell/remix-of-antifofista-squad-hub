import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlanPdfUrl } from "@/lib/squad.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { PdfViewer } from "@/components/PdfViewer";

export const Route = createFileRoute("/_authenticated/app/treino")({
  component: TreinoPage,
});

function TreinoPage() {
  const fetchUrl = useServerFn(getMyPlanPdfUrl);
  const { data, isLoading } = useQuery({
    queryKey: ["my-training-pdf"],
    queryFn: () => fetchUrl({ data: { kind: "training" } }),
  });

  if (isLoading) {
    return <p className="text-center py-16 text-muted-foreground">Carregando...</p>;
  }

  if (!data?.url) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Nenhum treino disponível ainda. Aguarde seu treinador enviar o PDF.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          PLANO ATIVO
        </p>
        <h1 className="tactical-heading text-2xl">{data.title || "Treino"}</h1>
        <div className="tactical-divider mt-2" />
      </div>

      <Card className="p-4 flex items-center gap-3">
        <FileText className="w-6 h-6 text-primary shrink-0" />
        <span className="flex-1 truncate text-sm">{data.name ?? "treino.pdf"}</span>
        <Button asChild size="sm" variant="outline">
          <a href={data.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-1" /> ABRIR
          </a>
        </Button>
      </Card>

      <PdfViewer url={data.url} />
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
