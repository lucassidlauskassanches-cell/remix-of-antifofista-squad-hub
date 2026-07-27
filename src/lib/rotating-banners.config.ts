import bannerCamiseta from "@/assets/banner-camiseta-antifofista.png.asset.json";
import bannerHeavySuppz from "@/assets/banner-heavy-suppz.png.asset.json";

export type RotatingBanner = {
  id: string;
  imageUrl: string;
  targetUrl: string;
  alt: string;
};

// Faixa rotativa fina no topo do app do aluno. Independente do pop-up semanal.
// Para adicionar/remover/trocar, basta editar este array.
export const ROTATING_BANNERS: RotatingBanner[] = [
  {
    id: "camiseta-supertrue",
    imageUrl: bannerCamiseta.url,
    targetUrl:
      "https://supertrue.com.br/produtos/camiseta-antifofista-squad-results-are-taken-2s03o/",
    alt: "Camiseta Antifofista Squad — Results Are Taken Not Given. Cupom ANTIFOFISTASQUAD.",
  },
  {
    id: "heavy-suppz",
    imageUrl: bannerHeavySuppz.url,
    targetUrl: "https://heavysuppz.com",
    alt: "Heavy Suppz — Cupom ANTIFOFISTASQUAD.",
  },
];
