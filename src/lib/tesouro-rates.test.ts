import { describe, expect, it } from "vitest";
import { parseTesouroCsv, tesouroCatalog } from "./tesouro-rates";

const CSV = [
  "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha",
  "Tesouro IPCA+;15/08/2040;29/09/2026;7,32;7,44;1789,66;1761,35;1761,35",
  "Tesouro IPCA+;15/08/2040;26/01/2016;6,10;6,20;500,00;490,00;490,00",
  "Tesouro Selic;01/03/2031;29/09/2026;0,08;0,09;19910,23;19891,29;19891,29",
  "Tesouro Renda+ Aposentadoria Extra;15/12/2069;29/09/2026;7,05;7,17;538,38;519,82;519,82",
  "Tesouro Prefixado;01/01/2029;29/09/2026;0,00;14,05;0,00;745,10;745,10",
  "Tesouro IPCA+;15/08/2040;28/09/2026;7,90;8,00;1700,00;1690,00;1690,00",
].join("\r\n");

describe("parseTesouroCsv", () => {
  it("fica com a data mais recente e casa família e vencimento com o catálogo", () => {
    const live = parseTesouroCsv(CSV)!;
    expect(live.date).toBe("29/09/2026");
    expect(live.rates["ipca-2040"]).toBe(7.32);
    expect(live.rates["selic-2031"]).toBe(0.08);
    expect(live.rates["renda-2050"]).toBe(7.05);
    expect(live.rates).not.toHaveProperty("prefixado-2029");
  });

  it("aplica as taxas ao catálogo e ignora dados mais velhos que o catálogo fixo", () => {
    const live = parseTesouroCsv(CSV)!;
    const { catalog, date } = tesouroCatalog(live);
    expect(date).toBe("29/09/2026");
    expect(catalog.find((e) => e.id === "ipca-2040")!.rate_value).toBe(7.32);
    expect(tesouroCatalog({ date: "01/01/2020", rates: { "ipca-2040": 1 } }).catalog.find((e) => e.id === "ipca-2040")!.rate_value).toBe(7.27);
    expect(parseTesouroCsv("lixo;sem;formato")).toBeNull();
  });
});
