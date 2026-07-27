import { useEffect, useState } from "react";
import { ROTATING_BANNERS } from "@/lib/rotating-banners.config";

const ROTATION_MS = 5000;
// Proporção aproximada das artes fornecidas (~7:1). Mantém a faixa fina e estável.
const ASPECT_RATIO = "7 / 1";

export function RotatingBannerStrip() {
  const banners = ROTATING_BANNERS;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % banners.length);
    }, ROTATION_MS);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className="w-full bg-background">
      <div className="max-w-3xl mx-auto px-4 py-2">
        <div
          className="relative w-full overflow-hidden rounded-md"
          style={{ aspectRatio: ASPECT_RATIO }}
        >
          {banners.map((b, i) => (
            <a
              key={b.id}
              href={b.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-hidden={i !== idx}
              tabIndex={i === idx ? 0 : -1}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === idx ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <img
                src={b.imageUrl}
                alt={b.alt}
                loading={i === 0 ? "eager" : "lazy"}
                className="w-full h-full object-cover object-center block"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
