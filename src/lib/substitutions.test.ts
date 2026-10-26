import { describe, expect, it } from "vitest";
import {
  SUBSTITUTION_GROUPS,
  calcSubstitution,
  matchDietFood,
  roundingHint,
} from "./substitutions";

function item(groupId: string, nome: string) {
  const g = SUBSTITUTION_GROUPS.find((x) => x.id === groupId)!;
  const it = g.itens.find((i) => i.nome === nome);
  if (!it) throw new Error(`item não encontrado: ${nome}`);
  return it;
}

const arroz = item("carboidrato", "Arroz branco ou integral");
const batataDoce = item("carboidrato", "Batata doce");
const carne = item("proteina", "Carne / Frango / Peixe");
const claras = item("proteina", "Claras");
const whey = item("proteina", "Whey Protein");

describe("regra de três (tabela oficial, pesos prontos)", () => {
  it("100g de arroz → 120g de batata doce", () => {
    expect(calcSubstitution(100, arroz, batataDoce)).toBe(120);
  });

  it("200g de arroz → 240g de batata doce", () => {
    expect(calcSubstitution(200, arroz, batataDoce)).toBe(240);
  });

  it("100g de carne → 5 claras, com observação do azeite", () => {
    expect(calcSubstitution(100, carne, claras)).toBe(5);
    expect(claras.obs).toContain("azeite");
  });

  it("100g de carne → 20g de whey, com observação da castanha", () => {
    expect(calcSubstitution(100, carne, whey)).toBe(20);
    expect(whey.obs).toContain("castanha de caju");
  });

  it("metade de duas: 50% da porção do substituto", () => {
    expect(calcSubstitution(100, arroz, batataDoce, 0.5)).toBe(60);
  });

  it("tapioca tem observação de goma crua", () => {
    expect(item("carboidrato", "Tapioca").obs).toContain("goma crua");
  });
});

describe("grupos", () => {
  it("nunca cruza grupos: carboidrato não oferece proteína nem gordura", () => {
    const carb = SUBSTITUTION_GROUPS.find((g) => g.id === "carboidrato")!;
    const nomes = carb.itens.map((i) => i.nome).join(" ");
    expect(nomes).not.toContain("Whey");
    expect(nomes).not.toContain("Claras");
    expect(nomes).not.toContain("Abacate");
  });

  it("fruta e vegetais são livres, sem conta", () => {
    const fruta = SUBSTITUTION_GROUPS.find((g) => g.id === "fruta")!;
    const veg = SUBSTITUTION_GROUPS.find((g) => g.id === "vegetais")!;
    expect(fruta.livre).toBe(true);
    expect(veg.livre).toBe(true);
    expect(fruta.observacao).toContain("exceto banana");
  });
});

describe("match de alimento da dieta", () => {
  it("arroz da dieta casa com o grupo carboidrato", () => {
    const m = matchDietFood("Arroz branco cozido");
    expect(m?.kind).toBe("item");
    if (m?.kind === "item") expect(m.group.id).toBe("carboidrato");
  });

  it("frango grelhado casa com proteína", () => {
    const m = matchDietFood("Frango grelhado");
    expect(m?.kind).toBe("item");
    if (m?.kind === "item") expect(m.group.id).toBe("proteina");
  });

  it("fruta da dieta cai no grupo livre de fruta", () => {
    const m = matchDietFood("Fruta");
    expect(m?.kind).toBe("free");
    if (m?.kind === "free") expect(m.group.id).toBe("fruta");
  });
});

describe("arredondamento de itens contáveis", () => {
  it("7,5 claras sugere arredondar para 7 ou 8", () => {
    expect(roundingHint(7.5, "claras")).toBe("arredonde para 7 ou 8");
  });

  it("valor inteiro ou unidade em gramas não sugere arredondamento", () => {
    expect(roundingHint(5, "claras")).toBeNull();
    expect(roundingHint(7.5, "g")).toBeNull();
  });
});
