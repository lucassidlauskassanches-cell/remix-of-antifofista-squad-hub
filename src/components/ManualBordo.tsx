import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addStudentNote,
  deleteStudentNote,
  getStudentBordo,
  saveStudentCrm,
} from "@/lib/crm.functions";
import {
  CATEGORIA_COR,
  CATEGORIA_LABEL,
  PLANO_TIPO_LABEL,
  STATUS_LABEL,
  type NoteCategoria,
} from "@/lib/crm-config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  Flame,
  Plus,
  Trash2,
} from "lucide-react";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function diasAtras(iso: string | null | undefined, today: string) {
  if (!iso) return null;
  const a = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function ManualBordo({ studentId }: { studentId: string }) {
  const fetchBordo = useServerFn(getStudentBordo);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["bordo", studentId],
    queryFn: () => fetchBordo({ data: { studentId } }),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["bordo", studentId] });
    void qc.invalidateQueries({ queryKey: ["trainer-panel"] });
  };

  if (isPending || !data) {
    return <p className="text-sm text-muted-foreground">Carregando manual de bordo...</p>;
  }

  return (
    <div className="space-y-4">
      {data.alerts.length > 0 && (
        <Card className="p-3 space-y-2 border-primary/40">
          <p className="tactical-heading text-xs text-primary">ALERTAS</p>
          <div className="flex flex-wrap gap-2">
            {data.alerts.map((a) => (
              <span
                key={a.key}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                  a.tone === "danger"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : a.tone === "warn"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                }`}
              >
                <AlertTriangle className="w-3 h-3" /> {a.label}
              </span>
            ))}
          </div>
        </Card>
      )}

      <ResumoVivo resumo={data.resumo} today={data.today} />

      <CrmHeader
        studentId={studentId}
        crm={data.crm}
        onSaved={invalidate}
      />

      <RegistroRapido studentId={studentId} onSaved={invalidate} />

      <ProximoCheckin
        studentId={studentId}
        crm={data.crm}
        today={data.today}
        onSaved={invalidate}
      />

      <LinhaDoTempo
        studentId={studentId}
        notes={data.notes}
        onSaved={invalidate}
      />
    </div>
  );
}

function ResumoVivo({
  resumo,
  today,
}: {
  resumo: {
    streak: number;
    adesao7: number | null;
    adesao30: number | null;
    lastWeight: number | null;
    lastWeightDate: string | null;
    lastActivity: string | null;
    hasPlan: boolean;
  };
  today: string;
}) {
  const dias = diasAtras(resumo.lastActivity, today);
  const items = [
    { label: "SEQUÊNCIA", value: `${resumo.streak} d`, icon: <Flame className="w-3 h-3" /> },
    {
      label: "ADESÃO 7D",
      value: resumo.adesao7 === null ? "—" : `${Math.round(resumo.adesao7)}%`,
    },
    {
      label: "ADESÃO 30D",
      value: resumo.adesao30 === null ? "—" : `${Math.round(resumo.adesao30)}%`,
    },
    {
      label: "ÚLTIMO PESO",
      value: resumo.lastWeight === null ? "—" : `${resumo.lastWeight} kg`,
    },
    {
      label: "ATIVIDADE",
      value: dias === null ? "nunca" : dias === 0 ? "hoje" : `há ${dias} d`,
    },
    { label: "PLANO", value: resumo.hasPlan ? "ativo" : "a montar" },
  ];
  return (
    <Card className="p-3">
      <p className="tactical-heading text-xs text-muted-foreground mb-2">RESUMO VIVO</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div key={it.label} className="rounded-md border border-border p-2">
            <p className="text-[10px] tracking-wider text-muted-foreground">{it.label}</p>
            <p className="text-sm font-semibold text-foreground flex items-center gap-1">
              {it.icon}
              {it.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CrmHeader({
  studentId,
  crm,
  onSaved,
}: {
  studentId: string;
  crm: any | null;
  onSaved: () => void;
}) {
  const save = useServerFn(saveStudentCrm);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    objetivo: crm?.objetivo ?? "",
    restricoes: crm?.restricoes ?? "",
    plano_tipo: crm?.plano_tipo ?? "",
    data_inicio: crm?.data_inicio ?? "",
    whatsapp_grupo_url: crm?.whatsapp_grupo_url ?? "",
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => save({ data: { studentId, ...payload } }),
    onSuccess: () => {
      toast.success("Manual de bordo atualizado");
      setOpen(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const status = (crm?.status ?? "ativo") as keyof typeof STATUS_LABEL;

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="tactical-heading text-xs text-muted-foreground">MANUAL DE BORDO</p>
          <p className="text-sm text-foreground mt-1">
            <span className="text-muted-foreground">Objetivo: </span>
            {crm?.objetivo || "—"}
          </p>
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Restrições: </span>
            {crm?.restricoes || "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {crm?.plano_tipo
              ? PLANO_TIPO_LABEL[crm.plano_tipo as keyof typeof PLANO_TIPO_LABEL]
              : "Plano —"}{" "}
            · início {fmt(crm?.data_inicio)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {crm?.whatsapp_grupo_url && (
            <Button asChild size="sm" variant="outline" className="tactical-heading text-xs">
              <a href={crm.whatsapp_grupo_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" /> GRUPO
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="tactical-heading text-xs"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "FECHAR" : "EDITAR"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          value={status}
          onValueChange={(v) => mutation.mutate({ status: v })}
        >
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border pt-3">
          <div>
            <Label className="text-xs">Objetivo</Label>
            <Textarea
              rows={2}
              value={form.objetivo}
              onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Restrições / lesões</Label>
            <Textarea
              rows={2}
              value={form.restricoes}
              onChange={(e) => setForm({ ...form, restricoes: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Plano</Label>
              <Select
                value={form.plano_tipo || undefined}
                onValueChange={(v) => setForm({ ...form, plano_tipo: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLANO_TIPO_LABEL).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Início</Label>
              <Input
                type="date"
                value={form.data_inicio ?? ""}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Grupo WhatsApp (opcional)</Label>
              <Input
                placeholder="https://chat.whatsapp.com/..."
                value={form.whatsapp_grupo_url ?? ""}
                onChange={(e) =>
                  setForm({ ...form, whatsapp_grupo_url: e.target.value })
                }
              />
            </div>
          </div>
          <Button
            className="tactical-heading w-full"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                objetivo: form.objetivo || null,
                restricoes: form.restricoes || null,
                plano_tipo: form.plano_tipo || null,
                data_inicio: form.data_inicio || null,
                whatsapp_grupo_url: form.whatsapp_grupo_url || null,
              })
            }
          >
            SALVAR
          </Button>
        </div>
      )}
    </Card>
  );
}

function RegistroRapido({
  studentId,
  onSaved,
}: {
  studentId: string;
  onSaved: () => void;
}) {
  const add = useServerFn(addStudentNote);
  const [categoria, setCategoria] = useState<NoteCategoria>("geral");
  const [texto, setTexto] = useState("");
  const mutation = useMutation({
    mutationFn: () => add({ data: { studentId, categoria, texto } }),
    onSuccess: () => {
      setTexto("");
      toast.success("Registro salvo");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar registro"),
  });

  return (
    <Card className="p-3 space-y-2">
      <p className="tactical-heading text-xs text-muted-foreground">REGISTRO RÁPIDO</p>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(CATEGORIA_LABEL) as NoteCategoria[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setCategoria(k)}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              categoria === k
                ? CATEGORIA_COR[k]
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {CATEGORIA_LABEL[k]}
          </button>
        ))}
      </div>
      <Textarea
        rows={2}
        placeholder="Ex.: ajustei a dieta, ombro doendo no supino, noites mal dormidas..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <Button
        className="tactical-heading w-full"
        disabled={!texto.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <Plus className="w-4 h-4 mr-1" /> SALVAR REGISTRO
      </Button>
    </Card>
  );
}

function ProximoCheckin({
  studentId,
  crm,
  today,
  onSaved,
}: {
  studentId: string;
  crm: any | null;
  today: string;
  onSaved: () => void;
}) {
  const save = useServerFn(saveStudentCrm);
  const atual = (crm?.proximo_checkin as string | null) ?? null;
  const [date, setDate] = useState(atual ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      save({ data: { studentId, proximo_checkin: date || null } }),
    onSuccess: () => {
      toast.success("Data do próximo check-in salva");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar a data"),
  });

  const dias = atual ? diasAtras(atual, today) : null;
  const aviso =
    dias === null
      ? "Nenhuma data definida."
      : dias > 0
        ? `Atrasado há ${dias} dia(s).`
        : dias === 0
          ? "É hoje."
          : `Faltam ${-dias} dia(s).`;

  return (
    <Card className="p-3 space-y-2">
      <p className="tactical-heading text-xs text-muted-foreground">
        DATA DO PRÓXIMO CHECK-IN
      </p>
      <p
        className={`text-sm ${
          dias !== null && dias >= 0 ? "text-destructive" : "text-foreground"
        }`}
      >
        <CalendarClock className="inline w-3 h-3 mr-1" />
        {fmt(atual)} · <span className="text-muted-foreground">{aviso}</span>
      </p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button
          className="tactical-heading"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          SALVAR
        </Button>
      </div>
    </Card>
  );
}

function LinhaDoTempo({
  studentId,
  notes,
  onSaved,
}: {
  studentId: string;
  notes: any[];
  onSaved: () => void;
}) {
  const del = useServerFn(deleteStudentNote);
  const delMutation = useMutation({
    mutationFn: (id: string) => del({ data: { studentId, id } }),
    onSuccess: onSaved,
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir"),
  });

  const items = useMemo(
    () =>
      notes
        .map((n) => ({
          kind: "nota" as const,
          id: n.id,
          data: n.data,
          categoria: n.categoria as NoteCategoria,
          texto: n.texto,
        }))
        .sort((x, y) => (x.data < y.data ? 1 : -1)),
    [notes],
  );

  return (
    <Card className="p-3 space-y-2">
      <p className="tactical-heading text-xs text-muted-foreground">LINHA DO TEMPO</p>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Nada registrado ainda.</p>
      )}
      {items.map((it) => (
        <div
          key={`${it.kind}-${it.id}`}
          className="flex items-start gap-2 rounded-md border border-border p-2"
        >
          <span
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${CATEGORIA_COR[it.categoria]}`}
          >
            {CATEGORIA_LABEL[it.categoria]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {it.texto}
            </p>
            <p className="text-[11px] text-muted-foreground">{fmt(it.data)}</p>
          </div>
          {it.kind === "nota" && (
            <button
              type="button"
              aria-label="Excluir registro"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => delMutation.mutate(it.id)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </Card>
  );
}
