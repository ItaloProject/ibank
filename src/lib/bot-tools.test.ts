import { describe, expect, it } from "vitest";
import { runBotTool } from "@/lib/bot-tools";

const CDI = 10;

describe("ferramentas do assistente", () => {
  it("rendimento por meses com IR de 17,5% (12 meses, CDB a 100% do CDI)", () => {
    const r = JSON.parse(runBotTool("calcular_aplicacao_meses", { valor: 10000, meses: 12, produto: "cdb", percentual_cdi: 100 }, CDI));
    expect(r.valor_final).toMatch(/10\.825,00/);
    expect(r.linhas.join(" ")).toContain("Imposto de Renda (17,5%)");
  });

  it("LCI não paga IR: 10% ao ano sobre R$ 10.000 vira R$ 11.000", () => {
    const r = JSON.parse(runBotTool("calcular_aplicacao_meses", { valor: 10000, meses: 12, produto: "lci", percentual_cdi: 100 }, CDI));
    expect(r.valor_final).toMatch(/11\.000,00/);
    expect(r.linhas.join(" ")).toContain("isento");
  });

  it("dias úteis pedidos são usados como dias úteis e o IOF continua pelos dias corridos", () => {
    const r = JSON.parse(runBotTool("calcular_aplicacao_dias", { valor: 1000, dias: 6, dias_uteis: 4, percentual_cdi: 100 }, CDI));
    expect(r.titulo).toContain("em 4 dias úteis");
    expect(r.linhas.join(" ")).toContain("IOF");
  });

  it("taxa prefixada ao ano é usada no lugar do CDI", () => {
    const r = JSON.parse(runBotTool("calcular_aplicacao_meses", { valor: 10000, meses: 12, produto: "cdb", taxa_anual: 12 }, CDI));
    expect(r.titulo).toContain("12% ao ano");
    expect(r.linhas.join(" ")).toMatch(/Rendimento bruto: R\$\s1\.200,00/);
  });

  it("recusa valores e prazos fora do limite", () => {
    expect(runBotTool("calcular_aplicacao_dias", { valor: 4000, dias: 0 }, CDI)).toMatch(/^Erro/);
    expect(runBotTool("calcular_aplicacao_meses", { valor: -5, meses: 12 }, CDI)).toMatch(/^Erro/);
    expect(runBotTool("calcular_aplicacao_meses", { valor: 1000, meses: 1000 }, CDI)).toMatch(/^Erro/);
  });

  it("produto desconhecido cai para CDB, e não inventa outro", () => {
    const r = JSON.parse(runBotTool("calcular_aplicacao_meses", { valor: 1000, meses: 12, produto: "bitcoin" }, CDI));
    expect(r.titulo).toContain("CDB");
  });

  it("consulta o CDI usado nas contas", () => {
    const r = JSON.parse(runBotTool("consultar_cdi", {}, 13.65));
    expect(r.cdi_anual_percent).toBe(13.65);
  });

  it("ferramenta desconhecida é recusada", () => {
    expect(runBotTool("apagar_carteira", {}, CDI)).toMatch(/^Erro/);
  });
});
