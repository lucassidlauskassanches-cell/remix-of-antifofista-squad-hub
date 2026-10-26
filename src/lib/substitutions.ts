import data from "@/lib/substitutions-data.json";

// ============= Tabela oficial de Trocas Equivalentes =============
// Pesos de alimentos JÁ PRONTOS. Trocas só dentro do mesmo grupo.
// Conta: quantidade_dieta × (porção_substituto ÷ porção_atual).

export type SubstitutionItem = {
  nome: string;
  qtd: number;
  unidade: string;
  obs?: string;
};

export type SubstitutionGroup = {
  id: string;
  nome: string;
  referencia?: string;
  livre?: boolean;
  observacao?: string;
  itens: SubstitutionItem[];
};

export const SUBSTITUTIONS_AVISO: string = data.aviso;

export const SUBSTITUTION_GROUPS: SubstitutionGroup[] = (
  data.grupos as unknown as (Omit<SubstitutionGroup, "itens"> & { itens?: SubstitutionItem[] })[]
).map((g) => ({ ...g, itens: g.itens ?? [] }));

export const COUNTABLE_UNITS = new Set([
  "claras",
  "un",
  "fatias",
  "colher de sopa rasa",
]);

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const QUALIFIERS = new Set([
  "cru", "crua", "crus", "cruas", "cozido", "cozida", "cozidos", "cozidas",
  "grelhado", "grelhada", "assado", "assada", "frito", "frita", "fresco",
  "fresca", "em", "de", "da", "do", "com", "sem", "s", "light", "integral",
  "lata", "enlatado", "enlatada", "branco", "branca", "g", "ml", "und", "kg",
  "porcao", "porcoes", "colher", "colheres", "fatia", "fatias", "unidade", "unidades",
  "extra", "virgem", "normal", "ou",
]);

function tokens(s: string) {
  return normalize(s).split(" ").filter((t) => t && !QUALIFIERS.has(t));
}

// Sinônimos comuns da dieta → token presente na tabela, pra casar nomes
// escritos de formas diferentes (ex.: "frango grelhado" → "carne").
const ALIASES: Record<string, string[]> = {
  frango: ["carne"],
  peixe: ["carne"],
  carne: ["carne"],
  ovo: ["claras"],
  ovos: ["claras"],
  clara: ["claras"],
  arroz: ["arroz"],
  macarrao: ["macarrao"],
  batata: ["batata"],
  mandioca: ["aipim"],
  pao: ["pao"],
  wrap: ["pao"],
  rap10: ["pao"],
  banana: ["fruta"],
  fruta: ["fruta"],
  frutas: ["fruta"],
  salada: ["vegetais"],
  legumes: ["vegetais"],
  vegetal: ["vegetais"],
};

export type MatchedFood =
  | { kind: "item"; group: SubstitutionGroup; item: SubstitutionItem }
  | { kind: "free"; group: SubstitutionGroup };

// Casa um alimento da dieta com a tabela. Conservador: exige boa
// sobreposição de palavras pra não sugerir troca de grupo errado.
export function matchDietFood(food: string): MatchedFood | null {
  const ft = tokens(food);
  if (!ft.length) return null;
  const expanded = new Set(ft);
  for (const t of ft) for (const a of ALIASES[t] ?? []) expanded.add(a);

  // Grupos livres (fruta / vegetais) casam por palavra-chave.
  for (const g of SUBSTITUTION_GROUPS) {
    if (!g.livre) continue;
    const gt = tokens(g.nome);
    if (gt.some((t) => expanded.has(t))) return { kind: "free", group: g };
  }

  let best: { group: SubstitutionGroup; item: SubstitutionItem } | null = null;
  let bestScore = 0;
  for (const group of SUBSTITUTION_GROUPS) {
    if (group.livre) continue;
    for (const item of group.itens) {
      const it = tokens(item.nome);
      if (!it.length) continue;
      const overlap = it.filter((t) => expanded.has(t)).length;
      if (overlap === 0) continue;
      const score = overlap / Math.max(it.length, ft.length);
      if (score > bestScore) {
        bestScore = score;
        best = { group, item };
      }
    }
  }
  return bestScore >= 0.5 ? { kind: "item", ...best! } : null;
}

// Regra de três: quantidade_dieta × (porção_substituto ÷ porção_atual).
// fraction permite "metade de duas" (0.5 = meia porção do substituto).
export function calcSubstitution(
  dietQty: number,
  from: SubstitutionItem,
  to: SubstitutionItem,
  fraction = 1,
): number {
  if (!(dietQty > 0) || !(from.qtd > 0) || !(to.qtd > 0) || !(fraction > 0)) return 0;
  const raw = dietQty * (to.qtd / from.qtd) * fraction;
  return Math.round(raw * 10) / 10;
}

export function isCountable(unidade: string) {
  return COUNTABLE_UNITS.has(unidade);
}

// Texto de arredondamento pra itens contáveis com fração (ex.: 7,5 claras).
export function roundingHint(value: number, unidade: string): string | null {
  if (!isCountable(unidade)) return null;
  if (Number.isInteger(value)) return null;
  const down = Math.floor(value);
  const up = Math.ceil(value);
  return `arredonde para ${down} ou ${up}`;
}

export function formatQty(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
