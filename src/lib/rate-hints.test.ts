import { describe, expect, it } from "vitest";
import { rateHintFromName } from "./rate-hints";

describe("preenchimento pela leitura do nome", () => {
  it("usa o catálogo do Tesouro para vencimento e taxa exatos", () => {
    expect(rateHintFromName("Tesouro IPCA+ 2040")).toMatchObject({ index: "ipca", value: 7.27, maturity: "2040-08-15" });
    expect(rateHintFromName("Tesouro IPCA+ com Juros Semestrais 2037")).toMatchObject({ maturity: "2037-05-15" });
    expect(rateHintFromName("Tesouro Selic 2031")).toMatchObject({ index: "selic", maturity: "2031-03-01" });
  });

  it("deduz o dia do vencimento de títulos do Tesouro fora do catálogo", () => {
    expect(rateHintFromName("Tesouro Prefixado 2027")).toMatchObject({ index: "pre", maturity: "2027-01-01", maturityApprox: false });
    expect(rateHintFromName("Tesouro Selic 2029")).toMatchObject({ index: "selic", maturity: "2029-03-01" });
  });

  it("lê taxa, indexador e data escritos no nome", () => {
    expect(rateHintFromName("CDB 110% do CDI 2028")).toMatchObject({ index: "cdi", value: 110, maturity: "2028-01-01", maturityApprox: true });
    expect(rateHintFromName("LCA IPCA + 6,5% 15/05/2030")).toMatchObject({ index: "ipca", value: 6.5, maturity: "2030-05-15" });
    expect(rateHintFromName("CDB prefixado 14,2% ao ano")).toMatchObject({ index: "pre", value: 14.2 });
    expect(rateHintFromName("Poupança Caixa")).toMatchObject({ index: "poupanca" });
  });

  it("o tipo do produto sozinho é só uma sugestão fraca", () => {
    expect(rateHintFromName("LCA · Banco do Brasil")).toMatchObject({ index: "cdi", weakIndex: true });
    expect(rateHintFromName("Reserva")).toBeNull();
    expect(rateHintFromName("Caixinha Turbo · Nubank")).toBeNull();
  });
});
