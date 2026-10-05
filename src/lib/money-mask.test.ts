import { describe, expect, it } from "vitest";
import { caretAfterGrouping, groupCalcNumbers, groupNumbers, maskMoney, parseMoneyMask, toMoneyMask } from "./money-mask";

describe("maskMoney", () => {
  it("preenche da direita para a esquerda", () => {
    expect(maskMoney("405807")).toBe("4.058,07");
    expect(maskMoney("5")).toBe("0,05");
    expect(maskMoney("123456789")).toBe("1.234.567,89");
  });

  it("aceita o texto já mascarado ao digitar mais um número", () => {
    expect(maskMoney("4.058,071")).toBe("40.580,71");
    expect(maskMoney("0,050")).toBe("0,50");
  });

  it("fica vazio sem dígitos", () => {
    expect(maskMoney("")).toBe("");
    expect(maskMoney("abc")).toBe("");
    expect(maskMoney("0,00")).toBe("");
  });

  it("converte de volta para número", () => {
    expect(parseMoneyMask("4.058,07")).toBe(4058.07);
    expect(parseMoneyMask("")).toBe(0);
    expect(toMoneyMask(4058.07)).toBe("4.058,07");
    expect(toMoneyMask(0.1 + 0.2)).toBe("0,30");
    expect(toMoneyMask(0)).toBe("");
  });
});

describe("groupNumbers", () => {
  it("põe pontos de milhar enquanto digita", () => {
    expect(groupNumbers("4058")).toBe("4.058");
    expect(groupNumbers("4058,07")).toBe("4.058,07");
    expect(groupNumbers("1.0000")).toBe("10.000");
    expect(groupNumbers("gastei 1500 em mercado")).toBe("gastei 1.500 em mercado");
    expect(groupNumbers("2500 + 1200 * 12")).toBe("2.500 + 1.200 * 12");
  });

  it("não muda o valor de números ambíguos", () => {
    expect(groupNumbers("10.5")).toBe("10.5");
    expect(groupNumbers("PETR4")).toBe("PETR4");
    expect(groupNumbers("200 + 50")).toBe("200 + 50");
    expect(groupNumbers("10%")).toBe("10%");
    expect(groupNumbers("1.")).toBe("1.");
  });
});

describe("groupCalcNumbers", () => {
  it("agrupa contas e deixa frases como estão", () => {
    expect(groupCalcNumbers("405807")).toBe("405.807");
    expect(groupCalcNumbers("4058,07 × 12")).toBe("4.058,07 × 12");
    expect(groupCalcNumbers("quanto rende 1000 em 2030")).toBe("quanto rende 1000 em 2030");
  });

  it("mantém o cursor depois do mesmo dígito", () => {
    expect(caretAfterGrouping("4058", 4, "4.058")).toBe(5);
    expect(caretAfterGrouping("40158 + 2", 3, "40.158 + 2")).toBe(4);
    expect(caretAfterGrouping("4.0580", 6, "40.580")).toBe(6);
  });
});
