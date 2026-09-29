import { describe, expect, it } from "vitest";
import { buildReportText, firstName } from "@/lib/report/report-text";
import { renderReportPdf, reportPdfFilename } from "@/lib/report/report-pdf";
import { buildRebalancePlan } from "@/lib/rebalance";
import type { PortfolioRow } from "@/lib/portfolio-return";
import type { UserSnapshot } from "@/lib/server/portfolio-snapshot";

const rows: PortfolioRow[] = [
  { id: "cdb", accountId: "cdb", nome: "CDB", classe: "renda_fixa", valor: 30000, peso: 0.75, taxa12m: 14, irLongo: 0.15, fonte: "", origem: "cadastrada", rate: null },
  { id: "acoes", accountId: null, nome: "Ações", classe: "acoes", valor: 10000, peso: 0.25, taxa12m: 11, irLongo: 0.15, fonte: "", origem: "mercado", rate: null },
];

function snapshot(over: Partial<UserSnapshot> = {}): UserSnapshot {
  const plan = buildRebalancePlan({ rows, profile: "moderado", aporte: 1000, gastoMensal: 2000 });
  return {
    userId: "u", nome: "italo silva", profile: "moderado", profileDefinido: true, metaRenda: null, aporte: 1000, aporteOrigem: "media",
    gastoMensal: 2000, portfolio: { total: 40000, caixa: 0, rows, positions: [] }, plan, holdings: [],
    rates: { selicAnual: 15, cdiAnual: 14.9, source: "bcb", updatedAt: "" } as UserSnapshot["rates"],
    curve: { selic: [15], cdi: [14.9], ipca: [4.5], source: "neutro" },
    geradoEm: "2026-09-25T15:00:00.000Z",
    ...over,
  };
}

describe("buildReportText", () => {
  it("monta o relatório com patrimônio, alocação, plano e aviso", () => {
    const text = buildReportText(snapshot());
    expect(text).toContain("*Relatório MUVO · 25/09/2026*");
    expect(text).toContain("Olá, Italo!");
    expect(text).toMatch(/\*Patrimônio:\* R\$\s?40\.000/);
    expect(text).toContain("*Plano para o aporte de");
    expect(text).toContain("não é recomendação de investimento");
    expect(text.length).toBeLessThanOrEqual(4000);
  });

  it("orienta quem ainda não tem investimentos", () => {
    const text = buildReportText(snapshot({ plan: null, portfolio: null }));
    expect(text).toContain("Ainda não encontrei investimentos");
  });

  it("lista as posições reais com a participação no patrimônio", () => {
    const text = buildReportText(snapshot());
    expect(text).toContain("*Onde está seu dinheiro*");
    expect(text).toMatch(/• CDB: R\$\s?30\.000 \(75%\)/);
    expect(text).toContain("*Fora da reserva (");
  });

  it("gera o PDF com o nome do cliente, mesmo com caracteres fora da fonte padrão", async () => {
    const pdf = await renderReportPdf(snapshot({ nome: "Italo Silva 🚀 → teste" }));
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(3000);
    expect(reportPdfFilename(snapshot({ nome: "João da Silva" }))).toBe("Relatorio-MUVO-Joao-da-Silva-2026-09-25.pdf");
  });

  it("primeiro nome capitalizado", () => {
    expect(firstName("  maria clara ")).toBe("Maria");
    expect(firstName("")).toBe("");
  });
});
