import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlanPdfUrl } from "@/lib/squad.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { PdfViewer } from "@/components/PdfViewer";

export const Route = createFileRoute("/_authenticated/app/treino/")({
  component: TreinoPdfPage,
});

function TreinoPdfPage() {
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
        Nenhuma planilha em PDF disponível ainda.
      </div>
    );
  }
  return (
    <div className="space-y-4">
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
