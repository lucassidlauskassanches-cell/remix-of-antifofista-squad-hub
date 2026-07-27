import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { pickBanner } from "@/lib/banners.config";
import { markBannerSeen } from "@/lib/banner.functions";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type Props = {
  isAluno: boolean;
  lastSeenAt: string | null | undefined;
};

export function PromoBannerModal({ isAluno, lastSeenAt }: Props) {
  const [open, setOpen] = useState(false);
  const mark = useServerFn(markBannerSeen);
  const banner = pickBanner();

  useEffect(() => {
    if (!isAluno || !banner) return;
    const last = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
    if (!last || Date.now() - last >= SEVEN_DAYS_MS) {
      setOpen(true);
      // Grava data/hora ao exibir para respeitar a janela de 7 dias.
      mark().catch(() => {});
    }
  }, [isAluno, lastSeenAt, banner, mark]);

  if (!open || !banner) return null;

  const close = () => setOpen(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Promoção Antifofista Squad"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={close}
    >
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "70vh" }}
      >
        <a
          href={banner.targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
          className="block"
        >
          <img
            src={banner.imageUrl}
            alt={banner.alt}
            className="rounded-2xl shadow-2xl object-contain"
            style={{ maxHeight: "70vh", maxWidth: "90vw", width: "auto", height: "auto" }}
          />
        </a>
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-background border-2 border-primary text-foreground flex items-center justify-center shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
