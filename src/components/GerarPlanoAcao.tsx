import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateActionPlan } from "@/lib/squad.functions";
import {
  getActionPlanInputs,
  saveActionPlanInputs,
} from "@/lib/registro.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FileText,
  ImageIcon,
  Sparkles,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { PlanData } from "@/lib/plano/template/types";
import { PlanoEditor } from "@/components/PlanoEditor";

// Painel da aba AÇÃO. Os arquivos (anamnese PDF + 3 fotos) ficam PERSISTIDOS,
// então o treinador pode regerar o plano sem re-enviar. Substituir um arquivo
// é opcional (basta clicar e escolher outro).

const DIAS = [
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
  "domingo",
];

type Slot = "anamnese" | "frente" | "lado" | "costas";

function FilePicker({
  label,
  hint,
  accept,
  file,
  savedName,
  savedUrl,
  onPick,
  icon,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  savedName?: string | null;
  savedUrl?: string | null;
  onPick: (f: File | null) => void;
  icon: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const hasFile = !!file;
  const hasSaved = !!savedUrl;
  const displayName = file
    ? file.name
    : savedName
      ? savedName
      : hasSaved
        ? "Arquivo salvo"
        : hint;
  return (
    <div className="flex items-center gap-2 w-full p-3 rounded-md border border-border bg-secondary/30">
      <span className="shrink-0 text-primary">
        {hasFile || hasSaved ? <CheckCircle2 className="w-5 h-5" /> : icon}
      </span>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
      >
        <span className="block tactical-heading text-xs tracking-widest text-primary">
          {label}
        </span>
        <span className="block text-xs text-muted-foreground truncate">
          {displayName}
        </span>
      </button>
      {hasSaved && !hasFile && (
        <a
          href={savedUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-primary"
          title="Abrir arquivo salvo"
          aria-label="Abrir arquivo salvo"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

export function GerarPlanoAcao({
  studentId,
  alunoNome,
}: {
  studentId: string;
  alunoNome: string;
}) {
  const generate = useServerFn(generateActionPlan);
  const fetchInputs = useServerFn(getActionPlanInputs);
  const saveInputs = useServerFn(saveActionPlanInputs);

  const inputsQ = useQuery({
    queryKey: ["action-plan-inputs", studentId],
    queryFn: () => fetchInputs({ data: { studentId } }),
  });

  const [anamnese, setAnamnese] = useState<File | null>(null);
  const [frente, setFrente] = useState<File | null>(null);
  const [lado, setLado] = useState<File | null>(null);
  const [costas, setCostas] = useState<File | null>(null);
  const [telefone, setTelefone] = useState("");
  const [ciclo, setCiclo] = useState(12);
  const [dia, setDia] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const hydrated = useRef(false);

  // Hydrate ciclo/dia/telefone from persisted inputs.
  useEffect(() => {
    if (hydrated.current) return;
    const inputs = inputsQ.data?.inputs;
    if (!inputs) return;
    setCiclo(Number(inputs.ciclo_meses) || 12);
    setDia(inputs.dia_feedback ?? "");
    setTelefone(inputs.telefone ?? "");
    hydrated.current = true;
  }, [inputsQ.data]);

  const savedInputs = inputsQ.data?.inputs ?? null;
  const savedSigned = inputsQ.data?.signed ?? null;

  async function uploadInput(slot: Slot, file: File): Promise<string> {
    const ext = slot === "anamnese" ? "pdf" : "jpg";
    const path = `${studentId}/_acao_input/${slot}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("plans")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    return path;
  }

  async function handleGenerate() {
    if (anamnese && anamnese.type !== "application/pdf")
      return toast.error("A anamnese precisa ser um PDF.");

    // For each slot: use newly picked file, else fall back to persisted path.
    const missing: string[] = [];
    if (!anamnese && !savedInputs?.anamnese_path) missing.push("anamnese (PDF)");
    if (!frente && !savedInputs?.foto_frente_path) missing.push("foto frente");
    if (!lado && !savedInputs?.foto_lado_path) missing.push("foto lado");
    if (!costas && !savedInputs?.foto_costas_path) missing.push("foto costas");
    if (missing.length) {
      return toast.error(`Faltam: ${missing.join(", ")}.`);
    }

    setLoading(true);
    try {
      const [
        anamnesePathNew,
        fotoFrentePathNew,
        fotoLadoPathNew,
        fotoCostasPathNew,
      ] = await Promise.all([
        anamnese ? uploadInput("anamnese", anamnese) : Promise.resolve(null),
        frente ? uploadInput("frente", frente) : Promise.resolve(null),
        lado ? uploadInput("lado", lado) : Promise.resolve(null),
        costas ? uploadInput("costas", costas) : Promise.resolve(null),
      ]);

      const anamnesePath = anamnesePathNew ?? savedInputs!.anamnese_path!;
      const fotoFrentePath = fotoFrentePathNew ?? savedInputs!.foto_frente_path!;
      const fotoLadoPath = fotoLadoPathNew ?? savedInputs!.foto_lado_path!;
      const fotoCostasPath = fotoCostasPathNew ?? savedInputs!.foto_costas_path!;

      // Persist any tweaks to ciclo/dia/telefone even if we don't regenerate.
      await saveInputs({
        data: {
          studentId,
          ciclo_meses: ciclo,
          dia_feedback: dia || null,
          telefone: telefone.trim() || null,
        },
      });

      const res = await generate({
        data: {
          studentId,
          alunoNome,
          cicloMeses: ciclo,
          diaFeedback: dia || undefined,
          telefone: telefone.trim() || undefined,
          anamnesePath,
          fotoFrentePath,
          fotoLadoPath,
          fotoCostasPath,
        },
      });
      setPlan(res.plan);
      // Reset picked files so labels show the newly persisted names.
      setAnamnese(null);
      setFrente(null);
      setLado(null);
      setCostas(null);
      inputsQ.refetch();
      toast.success("Plano gerado. Revise e baixe o PDF.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao gerar o plano.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (plan) {
    return (
      <PlanoEditor
        plan={plan}
        onChange={setPlan}
        onBack={() => setPlan(null)}
      />
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <p className="tactical-heading text-xs text-primary tracking-widest">
          GERAR PLANO DE AÇÃO
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Arquivos ficam salvos. Regere o plano quando quiser — só substitua um
          arquivo se precisar atualizar.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <FilePicker
          label="ANAMNESE (PDF)"
          hint="Toque pra escolher o PDF"
          accept="application/pdf"
          file={anamnese}
          savedName={savedInputs?.anamnese_name ?? null}
          savedUrl={savedSigned?.anamnese ?? null}
          onPick={setAnamnese}
          icon={<FileText className="w-5 h-5" />}
        />
        <FilePicker
          label="FOTO FRENTE"
          hint="Toque pra escolher a foto"
          accept="image/*"
          file={frente}
          savedUrl={savedSigned?.frente ?? null}
          onPick={setFrente}
          icon={<ImageIcon className="w-5 h-5" />}
        />
        <FilePicker
          label="FOTO LADO"
          hint="Toque pra escolher a foto"
          accept="image/*"
          file={lado}
          savedUrl={savedSigned?.lado ?? null}
          onPick={setLado}
          icon={<ImageIcon className="w-5 h-5" />}
        />
        <FilePicker
          label="FOTO COSTAS"
          hint="Toque pra escolher a foto"
          accept="image/*"
          file={costas}
          savedUrl={savedSigned?.costas ?? null}
          onPick={setCostas}
          icon={<ImageIcon className="w-5 h-5" />}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="tactical-heading text-xs tracking-widest text-primary">
            CICLO (MESES)
          </span>
          <input
            type="number"
            min={1}
            max={36}
            value={ciclo}
            onChange={(e) => setCiclo(Number(e.target.value) || 12)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="tactical-heading text-xs tracking-widest text-primary">
            DIA DO FEEDBACK
          </span>
          <select
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Sem dia fixo</option>
            {DIAS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="tactical-heading text-xs tracking-widest text-primary">
            TELEFONE (OPCIONAL)
          </span>
          <input
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(00) 00000-0000"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full tactical-heading bg-primary text-primary-foreground"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        {loading
          ? "GERANDO PLANO..."
          : savedInputs
            ? "REGERAR PLANO DE AÇÃO"
            : "GERAR PLANO DE AÇÃO"}
      </Button>
    </Card>
  );
}
