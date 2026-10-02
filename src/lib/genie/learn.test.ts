import { describe, expect, it } from "vitest";
import { applyLearned, looksLikeRephrase, toTemplate } from "./learn";

describe("aprender com a reformulação", () => {
  it("transforma números em lacunas", () => {
    expect(toTemplate("Botei 50 na budega", "gastei 50 no mercado")).toEqual({ phrase: "botei {0} na budega", rewrite: "gastei {0} no mercado" });
    expect(toTemplate("fechou a fatura", "quanto sobra?")).toEqual({ phrase: "fechou a fatura", rewrite: "quanto sobra" });
    expect(toTemplate("quanto sobra", "quanto sobra?")).toBeNull();
  });

  it("aplica com valores novos", () => {
    const learned = [{ phrase: "botei {0} na budega", rewrite: "gastei {0} no mercado" }];
    expect(applyLearned("Botei 30 na budega", learned)).toBe("gastei 30 no mercado");
    expect(applyLearned("botei 1.200,50 na budega!", learned)).toBe("gastei 1.200,50 no mercado");
    expect(applyLearned("botei 30 no bar", learned)).toBeNull();
  });

  it("só aprende quando parece reformulação", () => {
    expect(looksLikeRephrase("botei 50 na budega", "gastei 50 no mercado")).toBe(true);
    expect(looksLikeRephrase("como ta minha grana", "como esta meu mes")).toBe(true);
    expect(looksLikeRephrase("xpto blabla", "quanto posso gastar por dia")).toBe(false);
  });
});
