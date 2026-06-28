import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import type { PlanData } from "@/lib/plano/template/types";
import { renderPlanoHtml } from "@/lib/plano/template/render";
import { autoFit } from "@/lib/plano/autofit";

// Editor do Plano de Ação: renderiza o MESMO HTML/CSS do PDF dentro de um iframe
// isolado. Cada texto autoral é contenteditable (modo editable do render.ts); as
// edições voltam pro PlanData pelo data-path. O PDF é gerado a partir desse mesmo
// HTML (sem o "enfeite" de edição). Plano NÃO é salvo nem mostrado pro aluno.

const SECTIONS: { label: string; path: string }[] = [
  { label: "Bem-vindo", path: "bemVindo.paragraphs" },
  { label: "Objetivo", path: "objetivo.paragraphs" },
  { label: "Treino", path: "treino.paragraphs" },
  { label: "Dieta", path: "dieta.paragraphs" },
  { label: "Análise", path: "analise.paragraphs" },
];

const PAGE_W = 1240;

/* eslint-disable @typescript-eslint/no-explicit-any */
function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);
}

function setByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const child = cur[k];
    cur[k] = Array.isArray(child) ? [...child] : { ...child };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function readEl(el: HTMLElement): string {
  if (el.dataset.rich) {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-action]").forEach((b) => b.remove());
    return clone.innerHTML.trim();
  }
  return (el.textContent ?? "").trim();
}

// PDF via impressão do navegador (Salvar como PDF). É o "motor de PDF" v1, sem
// servidor: o mesmo Chrome do treinador renderiza o HTML A4. Dá pra trocar
// depois por um endpoint puppeteer/serviço de Chrome sem mexer no editor.
function downloadPdf(plan: PlanData) {
  const html = renderPlanoHtml(plan); // limpo, sem chrome de edição
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Libere os pop-ups deste site pra baixar o PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  const run = () => {
    try {
      const style = w.document.createElement("style");
      style.textContent =
        "*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}";
      w.document.head.appendChild(style);
      autoFit(w.document);
    } catch {
      /* ignora: segue pra impressão mesmo assim */
    }
    w.focus();
    w.print();
  };
  const fonts = (w.document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) fonts.ready.then(run).catch(() => setTimeout(run, 400));
  else setTimeout(run, 400);
}

export function PlanoEditor({
  plan,
  onChange,
  onBack,
}: {
  plan: PlanData;
  onChange: (p: PlanData) => void;
  onBack: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const planRef = useRef(plan);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [docHtml, setDocHtml] = useState(() =>
    renderPlanoHtml(plan, { editable: true }),
  );
  const [contentH, setContentH] = useState(1754);
  const [scale, setScale] = useState(0.6);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / PAGE_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const refit = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    autoFit(doc);
    const h = doc.documentElement.scrollHeight;
    if (h > 0) setContentH(h);
  }, []);

  const syncFromDom = useCallback((): PlanData => {
    const doc = iframeRef.current?.contentDocument;
    let next = planRef.current;
    if (doc) {
      doc.querySelectorAll<HTMLElement>("[data-path]").forEach((el) => {
        next = setByPath(next, el.dataset.path as string, readEl(el));
      });
    }
    planRef.current = next;
    return next;
  }, []);

  const rebuild = useCallback((next: PlanData) => {
    planRef.current = next;
    onChangeRef.current(next);
    setDocHtml(renderPlanoHtml(next, { editable: true }));
  }, []);

  const onLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    const onInput = (e: Event) => {
      const el = (e.target as HTMLElement)?.closest?.<HTMLElement>("[data-path]");
      if (!el) return;
      const next = setByPath(planRef.current, el.dataset.path as string, readEl(el));
      planRef.current = next;
      onChangeRef.current(next);
    };
    const onFocusOut = () => refit();
    const onClick = (e: Event) => {
      const btn = (e.target as HTMLElement)?.closest?.<HTMLElement>(
        "[data-action='del']",
      );
      if (!btn) return;
      e.preventDefault();
      const path = btn.dataset.path as string;
      const parts = path.split(".");
      const idx = Number(parts.pop());
      const parentPath = parts.join(".");
      const synced = syncFromDom();
      const arr = (getByPath(synced, parentPath) as string[]) || [];
      rebuild(setByPath(synced, parentPath, arr.filter((_, i) => i !== idx)));
    };

    doc.addEventListener("input", onInput);
    doc.addEventListener("focusout", onFocusOut);
    doc.addEventListener("click", onClick);

    const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) fonts.ready.then(refit).catch(refit);
    else refit();
  }, [refit, syncFromDom, rebuild]);

  function addPara(basePath: string) {
    const synced = syncFromDom();
    const arr = (getByPath(synced, basePath) as string[]) || [];
    rebuild(
      setByPath(synced, basePath, [
        ...arr,
        "Novo parágrafo. Clica aqui e escreve.",
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 sticky top-0 bg-background py-3 z-20 border-b border-border">
        <div>
          <p className="tactical-heading text-xs text-primary tracking-widest">
            REVISÃO · {planRef.current.alunoNome}
          </p>
          <h2 className="tactical-heading text-lg">
            Edite no plano e baixe o PDF
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Button
            size="sm"
            className="tactical-heading bg-primary text-primary-foreground"
            onClick={() => downloadPdf(syncFromDom())}
          >
            <Download className="w-4 h-4 mr-1" /> BAIXAR PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Clique em qualquer texto pra editar. Passe o mouse num parágrafo pra
          remover (✕). Adicionar parágrafo:
        </span>
        {SECTIONS.map((s) => (
          <button
            key={s.path}
            type="button"
            onClick={() => addPara(s.path)}
            className="border border-border rounded px-2 py-1 hover:border-primary hover:text-foreground"
          >
            + {s.label}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="w-full">
        <div
          className="mx-auto bg-black overflow-hidden"
          style={{ width: PAGE_W * scale, height: contentH * scale }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={docHtml}
            onLoad={onLoad}
            title="Pré-visualização do plano"
            style={{
              width: PAGE_W,
              height: contentH,
              border: 0,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
