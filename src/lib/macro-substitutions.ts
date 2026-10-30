// Calculadora de substituição por macros (Leitura B: iguala os gramas do
// macro-chave do grupo). A base fica em macro-substitutions-data.json.
import data from "./macro-substitutions-data.json";

export type MacroGroup = "proteina" | "carbo" | "gordura" | "fruta" | "sem_troca";
export type MacroFood = {
  nome: string;
  medida: string;
  grupo: MacroGroup;
  prot: number;
  carb: number;
  fat: number;
  excluir_como_substituto?: boolean;
  troca_restrita?: string[];
};

export const MACRO_FOODS = data as MacroFood[];

export const GROUP_LABEL: Record<MacroGroup, string> = {
  proteina: "Proteína",
  carbo: "Carboidrato",
  gordura: "Gordura",
  fruta: "Fruta",
  sem_troca: "Sem troca",
};

export function findFood(nome: string) {
  return MACRO_FOODS.find((f) => f.nome === nome);
}

export function isCountable(medida: string) {
  const m = medida.trim().toLowerCase();
  return m !== "g" && m !== "ml";
}

export function keyMacro(f: MacroFood): number {
  if (f.grupo === "proteina") return f.prot;
  if (f.grupo === "carbo") return f.carb;
  if (f.grupo === "gordura") return f.fat;
  return 0;
}

export function kcal(f: MacroFood, qty: number) {
  return qty * (f.prot * 4 + f.carb * 4 + f.fat * 9);
}

export function eligibleSubstitutes(origin: MacroFood): MacroFood[] {
  if (origin.grupo === "sem_troca") return [];
  if (origin.grupo === "fruta") {
    if (origin.troca_restrita?.length) {
      const allowed = new Set(origin.troca_restrita);
      return MACRO_FOODS.filter((f) => allowed.has(f.nome) && f.nome !== origin.nome);
    }
    return MACRO_FOODS.filter(
      (f) => f.grupo === "fruta" && f.nome !== origin.nome && !f.excluir_como_substituto,
    );
  }
  return MACRO_FOODS.filter(
    (f) =>
      f.grupo === origin.grupo &&
      f.nome !== origin.nome &&
      !f.excluir_como_substituto &&
      keyMacro(f) > 0,
  );
}

export function roundDown(value: number, medida: string): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (isCountable(medida)) {
    if (value < 1) return Math.floor(value * 10) / 10;
    return Math.floor(value + 1e-9);
  }
  return Math.floor(value / 10 + 1e-9) * 10;
}

export function calcMacroSubstitution(origin: MacroFood, sub: MacroFood, qty: number) {
  let raw: number;
  let result: number;
  if (origin.grupo === "fruta") {
    raw = qty;
    result = qty;
  } else {
    const k = keyMacro(sub);
    raw = k > 0 ? (qty * keyMacro(origin)) / k : 0;
    result = roundDown(raw, sub.medida);
  }
  return {
    raw,
    quantidade: result,
    kcalOrigem: kcal(origin, qty),
    kcalSubstituto: kcal(sub, result),
  };
}

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP = new Set(["de", "da", "do", "com", "sem", "em", "e", "ou", "g", "ml"]);
const tokens = (s: string) => normalize(s).split(" ").filter((t) => t && !STOP.has(t));

/** Casa o nome da dieta com a base: exato > maior sobreposição de palavras. */
export function matchMacroFood(name: string): MacroFood | null {
  const n = normalize(name);
  const exact = MACRO_FOODS.find((f) => normalize(f.nome) === n);
  if (exact) return exact;
  const ft = new Set(tokens(name));
  if (!ft.size) return null;
  let best: MacroFood | null = null;
  let bestScore = 0;
  for (const f of MACRO_FOODS) {
    const t = tokens(f.nome);
    const hits = t.filter((x) => ft.has(x)).length;
    if (!hits || !ft.has(t[0])) continue;
    const score = hits / t.length + hits / ft.size;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

export function formatNum(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
