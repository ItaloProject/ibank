import { describe, expect, it } from "vitest";
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";
import { buildCurve } from "./market-curve";
import { buildPortfolio } from "./portfolio-return";

const start = new Date(2026, 8, 25);
const curve = buildCurve({ selic: 15, cdi: 14.9, ipca12m: 5 }, 120, start);

const acc = (id: string, name: string, over: Partial<InvestmentAccount> = {}): InvestmentAccount => ({
  id, name, institution: "", current_balance: 0, created_at: "2026-01-01", is_turbo: false, cdi_percent: null,
  max_rendimento: null, valor_liquido: null, ...over,
});
const inv = (account_id: string, type: Investment["type"], amount: number, date = "2026-03-25"): Investment =>
  ({ id: `${account_id}-${type}-${amount}`, account_id, type, amount, description: "", date, created_at: "" });
const trade = (ticker: string, quantity: number, total: number, date = "2025-09-25"): StockTrade =>
  ({ id: ticker, user_id: "u", ticker, type: "compra", quantity, price_per_share: total / quantity, total_amount: total, notes: "", date, created_at: "" });

describe("montagem da carteira", () => {
  const accounts = [
    acc("turbo", "Caixinha Turbo", { is_turbo: true, current_balance: 5000, cdi_percent: 115 }),
    acc("tes", "Tesouro IPCA+ 2035", { rate_index: "ipca", rate_value: 6.92, maturity: "2035-05-15", tax_exempt: false }),
    acc("old", "Tesouro Prefixado 2029", { institution: "13,85% a.a." }),
    acc("eme", "Caixinha Emergência"),
    acc("cash", "Saldo em Conta"),
  ];
  const investments = [
    inv("tes", "deposito", 1000), inv("tes", "rendimento", 50),
    inv("old", "deposito", 500),
    inv("eme", "deposito", 600),
    inv("cash", "deposito", 400),
  ];
  const trades = [trade("PETR4", 10, 300), trade("MXRF11", 10, 100)];
  const quotes = [{ ticker: "PETR4", current_price: 40 }, { ticker: "MXRF11", current_price: 10 }];
  const p = buildPortfolio(accounts, investments, trades, quotes, curve, { MXRF11: 12 }, start)!;
  const row = (id: string) => p.rows.find((r) => r.id === id)!;

  it("identifica a origem de cada taxa", () => {
    expect(row("tes").origem).toBe("cadastrada");
    expect(row("old").origem).toBe("nome");
    expect(row("eme").origem).toBe("estimada");
    expect(row("fiis").origem).toBe("mercado");
    expect(row("cash").taxa12m).toBe(0);
  });

  it("soma o patrimônio e os pesos", () => {
    expect(p.total).toBeCloseTo(5000 + 1050 + 500 + 600 + 400 + 400 + 100, 6);
    expect(p.rows.reduce((s, r) => s + r.peso, 0)).toBeCloseTo(1, 10);
  });

  it("não direciona aportes para o dinheiro parado", () => {
    const cash = p.positions.find((x) => x.id === "cash")!;
    expect(cash.pesoAporte).toBe(0);
    expect(p.positions.reduce((s, x) => s + x.pesoAporte, 0)).toBeCloseTo(1, 10);
  });

  it("usa aportes como custo e a data deles como idade", () => {
    const tes = p.positions.find((x) => x.id === "tes")!;
    expect(tes.custo).toBe(1000);
    expect(tes.idadeMeses).toBeCloseTo(6, 1);
    expect(tes.vencimento).toBeGreaterThan(100);
    const acoes = p.positions.find((x) => x.id === "acoes")!;
    expect(acoes.custo).toBe(300);
    expect(acoes.valor).toBe(400);
    expect(acoes.tax).toBe("acoes");
  });

  it("aplica a regra do Turbo cadastrada", () => {
    expect(row("turbo").taxa12m).toBeGreaterThan(row("eme").taxa12m);
  });
});
