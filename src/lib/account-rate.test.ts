import { describe, expect, it } from "vitest";
import { accountRateFromText, describeRate, validateAccountRate } from "./account-rate";

describe("leitura da taxa no nome de contas antigas", () => {
  it("entende os formatos do Tesouro", () => {
    expect(accountRateFromText("Tesouro IPCA+ 2035 IPCA + 6,92%")).toEqual({ rate_index: "ipca", rate_value: 6.92, maturity: "2035-01-01", tax_exempt: false });
    expect(accountRateFromText("Tesouro Prefixado 2029 13,85% a.a.")).toEqual({ rate_index: "pre", rate_value: 13.85, maturity: "2029-01-01", tax_exempt: false });
    expect(accountRateFromText("Tesouro Selic 2029 Selic + 0,0463%")?.rate_value).toBeCloseTo(0.0463, 10);
  });

  it("não confunde o ano do título com o spread", () => {
    expect(accountRateFromText("Tesouro IPCA+ 2035")).toBeNull();
  });

  it("entende % do CDI e isenção", () => {
    expect(accountRateFromText("CDB 110% CDI")).toMatchObject({ rate_index: "cdi", rate_value: 110, tax_exempt: false });
    expect(accountRateFromText("LCI 95% do CDI")).toMatchObject({ rate_index: "cdi", rate_value: 95, tax_exempt: true });
    expect(accountRateFromText("Poupança")).toMatchObject({ rate_index: "poupanca", tax_exempt: true });
    expect(accountRateFromText("Caixinha Emergência Nubank")).toBeNull();
  });
});

describe("validação", () => {
  it("aceita uma taxa válida e rejeita valores absurdos", () => {
    expect(validateAccountRate({ rate_index: "cdi", rate_value: 105, maturity: "2027-06-01", tax_exempt: true }))
      .toEqual({ rate_index: "cdi", rate_value: 105, maturity: "2027-06-01", tax_exempt: true });
    expect(validateAccountRate({ rate_index: "cdi", rate_value: 0 })).toHaveProperty("error");
    expect(validateAccountRate({ rate_index: "pre", rate_value: 90 })).toHaveProperty("error");
    expect(validateAccountRate({ rate_index: "x", rate_value: 1 })).toHaveProperty("error");
    expect(validateAccountRate({ rate_index: "ipca", rate_value: 6, maturity: "15/05/2035" })).toHaveProperty("error");
  });

  it("descreve a taxa em português", () => {
    expect(describeRate({ rate_index: "ipca", rate_value: 6.92, maturity: "2035-05-15", tax_exempt: false })).toBe("IPCA + 6,92% até 2035");
  });
});
