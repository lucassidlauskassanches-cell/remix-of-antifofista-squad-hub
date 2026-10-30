import { describe, expect, it } from "vitest";
import { calcMacroSubstitution, eligibleSubstitutes, findFood, roundDown } from "./macro-substitutions";

const f = (n: string) => findFood(n)!;

describe("calculadora por macros", () => {
  it("100g arroz branco → 150g batata doce", () => {
    expect(calcMacroSubstitution(f("Arroz branco"), f("Batata doce coz"), 100).quantidade).toBe(150);
  });
  it("100g frango peito coz → whey (39,3g arredonda para baixo: 39g)", () => {
    expect(calcMacroSubstitution(f("Frango peito coz"), f("Whey"), 100).quantidade).toBe(39);
  });
  it("2 ovos → 4 claras", () => {
    expect(calcMacroSubstitution(f("Ovo"), f("Clara"), 2).quantidade).toBe(4);
  });
  it("abacaxi só troca por mamão/kiwi no mesmo peso", () => {
    const opts = eligibleSubstitutes(f("Abacaxi")).map((x) => x.nome).sort();
    expect(opts).toEqual(["Kiwi, cru", "Mamão", "Mamão, Formosa, cru", "Mamão, Papaia, cru"]);
    expect(calcMacroSubstitution(f("Abacaxi"), f("Kiwi, cru"), 130).quantidade).toBe(130);
  });
  it("fruta nunca oferece banana, mas banana pode ser origem", () => {
    expect(eligibleSubstitutes(f("Morango, cru")).some((x) => x.nome === "Banana")).toBe(false);
    expect(eligibleSubstitutes(f("Banana")).length).toBeGreaterThan(0);
  });
  it("nenhuma troca cruza grupos e sem_troca não oferece opções", () => {
    for (const n of ["Arroz branco", "Ovo", "Azeite"]) {
      expect(eligibleSubstitutes(f(n)).every((x) => x.grupo === f(n).grupo)).toBe(true);
    }
    expect(eligibleSubstitutes(f("Vegetais"))).toEqual([]);
  });
  it("exclui substitutos com macro-chave zero", () => {
    expect(eligibleSubstitutes(f("Bacon")).some((x) => x.fat === 0)).toBe(false);
  });
  it("arredondamento para baixo", () => {
    expect(roundDown(263, "g")).toBe(260);
    expect(roundDown(258, "g")).toBe(250);
    expect(roundDown(17.8, "g")).toBe(17);
    expect(roundDown(12.4, "Un.")).toBe(12);
    expect(roundDown(0.66, "colher")).toBe(0.6);
  });
});
