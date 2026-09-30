import { describe, expect, it } from "vitest";
import { buildRebalancePlan } from "./rebalance";
import { buildProfileTransition } from "./profile-transition";
import type { PortfolioRow } from "./portfolio-return";

function row(id: string, classe: PortfolioRow["classe"], valor: number, rate_index?: "ipca" | "pre" | "cdi"): PortfolioRow {
  return {
    id, nome: id, classe, valor, peso: 0, taxa12m: 10, irLongo: 0.15, fonte: "", origem: "catalogo",
    rate: rate_index ? { rate_index, rate_value: 6, maturity: null, tax_exempt: false } : null,
  } as unknown as PortfolioRow;
}

const rows = [
  row("reserva", "emergencia", 12_000),
  row("cdb", "renda_fixa", 30_000, "cdi"),
  row("ipca", "renda_fixa", 5_000, "ipca"),
  row("fii", "fiis", 3_000),
  row("acoes", "acoes", 2_000),
];
const base = { rows, aporte: 2000, gastoMensal: 2000, holdings: [], turbos: [] };

describe("buildProfileTransition", () => {
  it("de moderado para arrojado: mais risco, vende pós-fixado se quiser e leva meses só com aportes", () => {
    const from = buildRebalancePlan({ ...base, profile: "moderado" });
    const to = buildRebalancePlan({ ...base, profile: "arrojado" });
    const t = buildProfileTransition(to, from);
    expect(t.direcao).toBe("mais_risco");
    expect(t.vendas[0].bucket).toBe("pos");
    expect(t.mesesSoAportes).toBeGreaterThan(1);
    expect(t.classes.find((c) => c.bucket === "acoes")!.diff).toBeGreaterThan(0);
    expect(t.aporteDoMes.some((a) => a.bucket === "acoes")).toBe(true);
  });

  it("de moderado para conservador: reserva maior e menos risco", () => {
    const from = buildRebalancePlan({ ...base, profile: "moderado" });
    const to = buildRebalancePlan({ ...base, profile: "conservador" });
    const t = buildProfileTransition(to, from);
    expect(t.direcao).toBe("menos_risco");
    expect(t.reserva.alvoNovo).toBe(24_000);
    expect(t.reserva.atual).toBe(24_000);
    expect(t.reserva.falta).toBe(0);
  });

  it("sem aporte não estima prazo; carteira vazia é pequena", () => {
    const t = buildProfileTransition(buildRebalancePlan({ ...base, aporte: 0, profile: "arrojado" }));
    expect(t.mesesSoAportes).toBeNull();
    expect(t.from).toBeNull();
    expect(buildProfileTransition(buildRebalancePlan({ rows: [], aporte: 500, gastoMensal: null, profile: "arrojado" })).carteiraPequena).toBe(true);
  });
});
