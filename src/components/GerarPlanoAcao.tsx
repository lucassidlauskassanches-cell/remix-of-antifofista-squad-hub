import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { generateActionPlan } from "@/lib/squad.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, ImageIcon, Sparkles, CheckCircle2 } from "lucide-react";
import type { PlanData } from "@/lib/plano/template/types";
import { PlanoEditor } from "@/components/PlanoEditor";

// Painel da aba AÇÃO: o treinador sobe anamnese (PDF) + 3 fotos, escolhe o
// ciclo e o dia do acompanhamento, e a IA gera o Plano de Ação reaproveitando
// o treino/dieta já cadastrados. O plano NÃO é salvo nem aparece pro aluno:
// o treinador revisa, edita e baixa o PDF. Tudo acontece nesta tela.

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
  onPick,
  icon,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onPick: (f: File | null) => void;
  icon: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="flex items-center gap-3 w-full text-left p-3 rounded-md border border-border bg-secondary/30 hover:border-primary transition-colors"
    >
      <span className="shrink-0 text-primary">
        {file ? <CheckCircle2 className="w-5 h-5" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block tactical-heading text-xs tracking-widest text-primary">
          {label}
        </span>
        <span className="block text-xs text-muted-foreground truncate">
          {file ? file.name : hint}
        </span>
      </span>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </button>
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

  const [anamnese, setAnamnese] = useState<File | null>(null);
  const [frente, setFrente] = useState<File | null>(null);
  const [lado, setLado] = useState<File | null>(null);
  const [costas, setCostas] = useState<File | null>(null);
  const [telefone, setTelefone] = useState("");
  const [ciclo, setCiclo] = useState(12);
  const [dia, setDia] = useState("");
  const [loading, setLoading] = useState(false);

  const [plan, setPlan] = useState<PlanData | null>(null);

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
    if (!anamnese) return toast.error("Envie a anamnese em PDF.");
    if (!frente || !lado || !costas)
      return toast.error("Envie as 3 fotos (frente, lado e costas).");
    if (anamnese.type !== "application/pdf")
      return toast.error("A anamnese precisa ser um PDF.");

    setLoading(true);
    try {
      const [anamnesePath, fotoFrentePath, fotoLadoPath, fotoCostasPath] =
        await Promise.all([
          uploadInput("anamnese", anamnese),
          uploadInput("frente", frente),
          uploadInput("lado", lado),
          uploadInput("costas", costas),
        ]);

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
          A IA escreve o plano personalizado usando a anamnese, as fotos e o
          treino/dieta já cadastrados deste aluno. O plano não é salvo nem
          aparece pro aluno: você revisa, edita e baixa o PDF.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <FilePicker
          label="ANAMNESE (PDF)"
          hint="Toque pra escolher o PDF"
          accept="application/pdf"
          file={anamnese}
          onPick={setAnamnese}
          icon={<FileText className="w-5 h-5" />}
        />
        <FilePicker
          label="FOTO FRENTE"
          hint="Toque pra escolher a foto"
          accept="image/*"
          file={frente}
          onPick={setFrente}
          icon={<ImageIcon className="w-5 h-5" />}
        />
        <FilePicker
          label="FOTO LADO"
          hint="Toque pra escolher a foto"
          accept="image/*"
          file={lado}
          onPick={setLado}
          icon={<ImageIcon className="w-5 h-5" />}
        />
        <FilePicker
          label="FOTO COSTAS"
          hint="Toque pra escolher a foto"
          accept="image/*"
          file={costas}
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
        {loading ? "GERANDO PLANO..." : "GERAR PLANO DE AÇÃO"}
      </Button>
    </Card>
  );
}
