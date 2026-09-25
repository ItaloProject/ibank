import { describe, expect, it } from "vitest";
import type { Curve } from "./market-curve";
import { cdiMonthly, project, regressiveRate, ruleAnnual, solveAporte, type Position } from "./projection";

const flat = (cdi: number, ipca = 4, selic = cdi + 0.1, n = 1200): Curve => ({
  cdi: Array(n).fill(cdi),
  selic: Array(n).fill(selic),
  ipca: Array(n).fill(ipca),
  source: "focus",
});

const pos = (over: Partial<Position> = {}): Position => ({
  id: "p",
  valor: 1000,
  custo: 1000,
  idadeMeses: 0,
  rule: { k: "cdi", pct: 100 },
  vencimento: null,
  tax: "regressivo",
  pesoAporte: 1,
  ...over,
});

describe("tabela regressiva do IR", () => {
  it("respeita as faixas de 180, 360 e 720 dias", () => {
    expect(regressiveRate(5.9)).toBe(0.225);
    expect(regressiveRate(6)).toBe(0.2);
    expect(regressiveRate(11.8)).toBe(0.2);
    expect(regressiveRate(12)).toBe(0.175);
    expect(regressiveRate(23.6)).toBe(0.175);
    expect(regressiveRate(24)).toBe(0.15);
  });
});

describe("rendimento pós-fixado", () => {
  it("100% do CDI rende exatamente o CDI anual em 12 meses", () => {
    const m = project({ positions: [pos()], aporte: 0, meses: 12, curve: flat(12) });
    expect(m[12].bruto).toBeCloseTo(1120, 6);
  });

  it("% do CDI incide sobre a taxa diária", () => {
    const daily = Math.pow(1.12, 1 / 252) - 1;
    expect(ruleAnnual({ k: "cdi", pct: 110 }, flat(12))).toBeCloseTo((Math.pow(1 + daily * 1.1, 252) - 1) * 100, 8);
    expect(cdiMonthly(12, 100)).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1, 12);
  });

  it("desconta 17,5% de IR sobre o ganho de 12 meses", () => {
    const m = project({ positions: [pos()], aporte: 0, meses: 12, curve: flat(12) });
    expect(m[12].liquido).toBeCloseTo(1120 - 0.175 * 120, 6);
  });

  it("aplica 15% quando o dinheiro já tem mais de 2 anos", () => {
    const m = project({ positions: [pos({ idadeMeses: 30, custo: 800 })], aporte: 0, meses: 1, curve: flat(12) });
    expect(m[0].liquido).toBeCloseTo(1000 - 0.15 * 200, 6);
  });
});

describe("vencimento", () => {
  it("paga o IR no vencimento e reaplica o líquido a 100% do CDI", () => {
    const m = project({
      positions: [pos({ rule: { k: "pre", taxa: 12 }, vencimento: 6 })],
      aporte: 0,
      meses: 12,
      curve: flat(12),
    });
    const bruto6 = 1000 * Math.pow(1.12, 0.5);
    const liquido6 = bruto6 - 0.2 * (bruto6 - 1000);
    expect(m[6].bruto).toBeCloseTo(liquido6, 6);
    const bruto12 = liquido6 * Math.pow(1.12, 0.5);
    expect(m[12].bruto).toBeCloseTo(bruto12, 6);
    expect(m[12].liquido).toBeCloseTo(bruto12 - 0.2 * (bruto12 - liquido6), 6);
  });
});

describe("regras especiais", () => {
  it("Turbo: acima do teto rende 100% do CDI", () => {
    const curve = flat(12);
    const m = project({ positions: [pos({ valor: 2000, custo: 2000, rule: { k: "cdi", pct: 120 }, teto: 1000 })], aporte: 0, meses: 1, curve });
    const r = (1000 * cdiMonthly(12, 120) + 1000 * cdiMonthly(12, 100)) / 2000;
    expect(m[1].bruto).toBeCloseTo(2000 * (1 + r), 8);
  });

  it("isento não paga IR; ações pagam 15% em qualquer prazo", () => {
    const isento = project({ positions: [pos({ tax: "isento" })], aporte: 0, meses: 3, curve: flat(12) });
    expect(isento[3].liquido).toBeCloseTo(isento[3].bruto, 10);
    const acoes = project({ positions: [pos({ tax: "acoes" })], aporte: 0, meses: 3, curve: flat(12) });
    expect(acoes[3].liquido).toBeCloseTo(acoes[3].bruto - 0.15 * (acoes[3].bruto - 1000), 8);
  });

  it("poupança rende 0,5% ao mês com Selic acima de 8,5%", () => {
    const m = project({ positions: [pos({ rule: { k: "poupanca" }, tax: "isento" })], aporte: 0, meses: 1, curve: flat(10) });
    expect(m[1].bruto).toBeCloseTo(1005, 8);
  });

  it("IPCA + spread compõe inflação e juro real", () => {
    expect(ruleAnnual({ k: "ipca", spread: 6 }, flat(12, 4))).toBeCloseTo((1.04 * 1.06 - 1) * 100, 8);
  });
});

describe("aportes", () => {
  it("soma aportes e corrige pela inflação quando pedido", () => {
    const curve = flat(12, 6);
    const m = project({ positions: [pos({ valor: 0, custo: 0 })], aporte: 100, meses: 2, curve, aporteCorrigido: true });
    expect(m[1].aporteMes).toBeCloseTo(100, 8);
    expect(m[2].aporteMes).toBeCloseTo(100 * Math.pow(1.06, 1 / 12), 8);
  });

  it("cada lote de aporte tem sua própria alíquota", () => {
    const m = project({ positions: [pos({ valor: 0, custo: 0 })], aporte: 100, meses: 13, curve: flat(12) });
    const last = m[13];
    const r = Math.pow(1.12, 1 / 12) - 1;
    let expectedTax = 0;
    for (let s = 0; s < 13; s++) {
      const value = 100 * Math.pow(1 + r, 13 - s);
      expectedTax += regressiveRate(13 - s) * (value - 100);
    }
    expect(last.liquido).toBeCloseTo(last.bruto - expectedTax, 6);
  });

  it("encontra o aporte que leva exatamente ao alvo", () => {
    const base = { positions: [pos()], meses: 120, curve: flat(11) };
    const aporte = solveAporte(base, 250_000, (p) => p.liquido);
    const m = project({ ...base, aporte });
    expect(m[120].liquido).toBeCloseTo(250_000, 0);
  });

  it("não pede aporte quando o inicial já basta", () => {
    expect(solveAporte({ positions: [pos({ valor: 1e6, custo: 1e6 })], meses: 12, curve: flat(12) }, 1000, (p) => p.bruto)).toBe(0);
  });
});
