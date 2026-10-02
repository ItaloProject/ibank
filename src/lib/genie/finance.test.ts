import { describe, expect, it } from "vitest";
import { parseGenie } from "./parse";
import { answer, type PlanSnapshot } from "./answer";
import { amortization, incomeTaxRate, netYield, taxedEquivalent } from "@/lib/finance-calc";

const p = (s: string) => parseGenie(s, ["CASA"], 13.65);
const empty: PlanSnapshot = { month: "2026-10", monthLabel: "outubro", salary: 0, groups: [], items: [] };

describe("contas de investimento", () => {
  it("calcula com a tabela do Imposto de Renda", () => {
    expect(incomeTaxRate(6)).toBe(0.225);
    expect(incomeTaxRate(12)).toBe(0.2);
    expect(incomeTaxRate(24)).toBe(0.175);
    expect(incomeTaxRate(25)).toBe(0.15);
    expect(taxedEquivalent(90, 36)).toBeCloseTo(105.88, 1);
    const r = netYield(10_000, 0.1, 12, false);
    expect(r.gross).toBe(1000);
    expect(r.net).toBe(800);
  });

  it("entende rendimento líquido", () => {
    expect(p("quanto rendem 10 mil no CDB a 110% do CDI em 2 anos?")).toEqual({ kind: "netYield", amount: 10000, product: "cdb", pct: 110, rateYear: null, months: 24 });
    expect(p("quanto rende 5.000 na poupança em 1 ano")).toMatchObject({ kind: "netYield", amount: 5000, product: "poupanca", months: 12 });
    expect(p("1000 na lci 95% do cdi por 18 meses, quanto fica?")).toMatchObject({ kind: "netYield", amount: 1000, product: "lci", pct: 95, months: 18 });
  });

  it("compara e acha equivalência", () => {
    expect(p("LCI a 90% ou CDB a 110%?")).toEqual({ kind: "compareYield", options: [{ product: "lci", pct: 90 }, { product: "cdb", pct: 110 }], months: null });
    expect(p("o que é melhor cdb 110% do cdi ou lca 92% em 2 anos")).toMatchObject({ kind: "compareYield", months: 24 });
    expect(p("lci de 90% equivale a quanto em cdb?")).toMatchObject({ kind: "equivalent", product: "lci", pct: 90 });
    expect(answer(p("LCI a 90% ou CDB a 110%?"), empty)!.value).toBe("LCI a 90%");
    expect(answer(p("LCI a 90% ou CDB a 110% em 3 anos"), empty)!.value).toBe("CDB a 110%");
  });

  it("ganho real, independência e 50/30/20", () => {
    expect(p("rendimento real de 12% com inflação de 4,5%")).toEqual({ kind: "realReturn", nominal: 12, inflation: 4.5 });
    expect(p("quanto preciso para viver de renda?")).toEqual({ kind: "freedom", monthly: null });
    expect(p("independência financeira com 5 mil por mês")).toEqual({ kind: "freedom", monthly: 5000 });
    expect(p("regra 50/30/20")).toEqual({ kind: "budgetRule" });
    expect(answer({ kind: "freedom", monthly: 5000 }, empty)!.value).toBe((1_500_000).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  });

  it("não atrapalha os pedidos do planejamento", () => {
    expect(p("adicionar CDB 500 em casa").kind).toBe("addItems");
    expect(p("gastei 200 no cheque especial").kind).toBe("spend");
    expect(p("500 por mês a 1% ao mês por 2 anos").kind).toBe("compound");
    expect(p("parcela de 10.000 em 12x a 2% ao mês").kind).toBe("installment");
  });
});

describe("dívidas", () => {
  it("rotativo e cheque especial", () => {
    expect(p("tenho 2.000 no rotativo do cartão")).toEqual({ kind: "debt", type: "rotativo", amount: 2000, rateMonth: null });
    expect(p("estou no cheque especial")).toMatchObject({ kind: "debt", type: "cheque", amount: null });
    const a = answer(p("tenho 2.000 no rotativo do cartão"), empty)!;
    expect(a.lines!.at(-1)!.value).toBe((4000).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  });

  it("quitar ou investir", () => {
    expect(p("é melhor quitar a dívida ou investir?")).toEqual({ kind: "payOrInvest", rateMonth: null });
    expect(p("quitar dívida de 3% ao mês ou investir")).toMatchObject({ kind: "payOrInvest", rateMonth: 0.03 });
  });

  it("SAC contra Price", () => {
    expect(p("SAC ou Price para 200 mil em 360 meses a 0,8% ao mês")).toMatchObject({ kind: "amortization", principal: 200000, months: 360 });
    const r = amortization(120_000, 12, 0.01);
    expect(r.sac.interest).toBeLessThan(r.price.interest);
    expect(r.sac.first).toBe(11_200);
  });
});
