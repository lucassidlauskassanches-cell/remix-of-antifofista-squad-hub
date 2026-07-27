import bannerCamiseta from "@/assets/banner-camiseta-antifofista.png.asset.json";

export type PromoBanner = {
  id: string;
  imageUrl: string;
  targetUrl: string;
  alt: string;
};

// Lista de banners promocionais. Adicione novos itens para alternar semanalmente.
// A cada exibição elegível (>=7 dias desde a última), o banner é escolhido
// pelo índice do "bucket semanal" atual, alternando entre as campanhas.
export const PROMO_BANNERS: PromoBanner[] = [
  {
    id: "camiseta-results-are-taken",
    imageUrl: bannerCamiseta.url,
    targetUrl:
      "https://supertrue.com.br/produtos/camiseta-antifofista-squad-results-are-taken-2s03o/",
    alt: "Camiseta Antifofista Squad — Results Are Taken Not Given. Cupom exclusivo ANTIFOFISTASQUAD.",
  },
];

/** Seleciona o banner a mostrar para esta semana. */
export function pickBanner(now: Date = new Date()): PromoBanner | null {
  if (PROMO_BANNERS.length === 0) return null;
  const weekBucket = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  return PROMO_BANNERS[weekBucket % PROMO_BANNERS.length];
}
