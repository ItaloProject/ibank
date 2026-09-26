import { describe, expect, it } from "vitest";
import { buildRebalancePlan, bucketOf } from "@/lib/rebalance";
import type { PortfolioRow } from "@/lib/portfolio-return";

function row(p: Partial<PortfolioRow> & Pick<PortfolioRow, "id" | "classe" | "valor">): PortfolioRow {
  return {
    accountId: p.id, nome: p.id, peso: 0, taxa12m: 12, irLongo: 0.15, fonte: "", origem: "cadastrada", rate: null, ...p,
  };
}

function withWeights(rows: PortfolioRow[]) {
  const total = rows.reduce((s, r) => s + r.valor, 0);
  return rows.map((r) => ({ ...r, peso: r.valor / total }));
}

const sum = (xs: { valor: number }[]) => xs.reduce((s, x) => s + x.valor, 0);

describe("bucketOf", () => {
  it("classifica pelo indexador da renda fixa", () => {
    expect(bucketOf(row({ id: "a", classe: "renda_fixa", valor: 1, rate: { rate_index: "ipca", rate_value: 6, maturity: null, tax_exempt: false } }))).toBe("inflacao");
    expect(bucketOf(row({ id: "b", classe: "renda_fixa", valor: 1, rate: { rate_index: "pre", rate_value: 13, maturity: null, tax_exempt: false } }))).toBe("prefixado");
    expect(bucketOf(row({ id: "c", classe: "renda_fixa", valor: 1 }))).toBe("pos");
    expect(bucketOf(row({ id: "d", classe: "turbo", valor: 1 }))).toBe("pos");
    expect(bucketOf(row({ id: "e", classe: "emergencia", valor: 1 }))).toBe("reserva");
  });
});

describe("buildRebalancePlan", () => {
  it("usa pós-fixado para cobrir a reserva e compara o resto com o alvo", () => {
    const plan = buildRebalancePlan({
      rows: withWeights([row({ id: "cdb", classe: "renda_fixa", valor: 20000 }), row({ id: "acoes", classe: "acoes", valor: 10000, accountId: null })]),
      profile: "moderado",
      aporte: 0,
      gastoMensal: 2000,
    });
    expect(plan.reserva).toMatchObject({ atual: 12000, alvo: 12000, meses: 6 });
    const pos = plan.buckets.find((b) => b.id === "pos")!;
    expect(pos.valor).toBe(8000);
    expect(pos.pct).toBeCloseTo(44.44, 1);
  });

  it("aporte completa a reserva antes de tudo", () => {
    const plan = buildRebalancePlan({
      rows: withWeights([row({ id: "acoes", classe: "acoes", valor: 5000, accountId: null })]),
      profile: "moderado",
      aporte: 1000,
      gastoMensal: 3000,
    });
    expect(plan.plano).toEqual([{ bucket: "reserva", label: "Reserva de emergência", valor: 1000 }]);
    expect(plan.sugestoes[0].id).toBe("reserva");
  });

  it("distribui o aporte para as classes abaixo do alvo e soma exatamente o aporte", () => {
    const plan = buildRebalancePlan({
      rows: withWeights([
        row({ id: "res", classe: "emergencia", valor: 20000 }),
        row({ id: "cdb", classe: "renda_fixa", valor: 30000 }),
      ]),
      profile: "arrojado",
      aporte: 2000,
      gastoMensal: 3000,
    });
    expect(sum(plan.plano)).toBeCloseTo(2000, 2);
    expect(plan.plano.find((a) => a.bucket === "pos")).toBeUndefined();
    expect(plan.plano[0].bucket).toBe("acoes");
  });

  it("sem desvio, o aporte segue os pesos do perfil", () => {
    const plan = buildRebalancePlan({
      rows: withWeights([
        row({ id: "res", classe: "emergencia", valor: 3000 }),
        row({ id: "pos", classe: "renda_fixa", valor: 30000 }),
        row({ id: "ipca", classe: "renda_fixa", valor: 25000, rate: { rate_index: "ipca", rate_value: 6, maturity: null, tax_exempt: false } }),
        row({ id: "pre", classe: "renda_fixa", valor: 10000, rate: { rate_index: "pre", rate_value: 13, maturity: null, tax_exempt: false } }),
        row({ id: "fiis", classe: "fiis", valor: 15000, accountId: null }),
        row({ id: "acoes", classe: "acoes", valor: 20000, accountId: null }),
      ]),
      profile: "moderado",
      aporte: 1000,
      gastoMensal: null,
    });
    expect(plan.desvio).toBeCloseTo(0, 5);
    expect(plan.plano.find((a) => a.bucket === "pos")?.valor).toBe(300);
    expect(plan.plano.find((a) => a.bucket === "acoes")?.valor).toBe(200);
  });

  it("sinaliza saldo parado, teto do Turbo, concentração e vencimento próximo", () => {
    const today = new Date("2026-09-01T12:00:00");
    const plan = buildRebalancePlan({
      rows: withWeights([
        row({ id: "caixa", classe: "caixa", valor: 5000, accountId: null }),
        row({ id: "turbo", classe: "turbo", valor: 15000, accountId: null }),
        row({ id: "lci", classe: "renda_fixa", valor: 10000, rate: { rate_index: "cdi", rate_value: 95, maturity: "2026-12-01", tax_exempt: true } }),
      ]),
      profile: "moderado",
      aporte: 500,
      gastoMensal: null,
      holdings: [{ ticker: "PETR4", kind: "acao", valor: 8000 }, { ticker: "ITSA4", kind: "acao", valor: 2000 }],
      turbos: [{ nome: "Turbo", saldo: 15000, teto: 10000 }],
      today,
    });
    const ids = plan.sugestoes.map((s) => s.id);
    expect(ids).toContain("caixa");
    expect(ids).toContain("turbo-Turbo");
    expect(ids).toContain("conc-acao");
    expect(ids).toContain("venc-lci");
    expect(plan.sugestoes.findIndex((s) => s.prioridade === "baixa")).not.toBe(0);
  });
});
