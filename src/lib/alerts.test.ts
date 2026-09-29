import { describe, expect, it } from "vitest";
import { buildAlerts } from "@/lib/alerts";
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";

const today = new Date(2026, 8, 29, 12);

function account(p: Partial<InvestmentAccount> & Pick<InvestmentAccount, "id" | "name">): InvestmentAccount {
  return { institution: "", current_balance: 0, created_at: "", is_turbo: false, cdi_percent: null, max_rendimento: null, valor_liquido: null, ...p };
}
function inv(account_id: string, amount: number, date: string, type: Investment["type"] = "deposito"): Investment {
  return { id: `${account_id}-${date}`, account_id, type, amount, description: "", date, created_at: date };
}
function trade(ticker: string, type: StockTrade["type"], total: number, date: string): StockTrade {
  return { id: `${ticker}-${date}`, user_id: "u", ticker, type, quantity: 1, price_per_share: total, total_amount: total, notes: "", date, created_at: date };
}

describe("buildAlerts", () => {
  it("avisa saldo parado há mais de 7 dias com atalho para investir o valor", () => {
    const alerts = buildAlerts({
      accounts: [account({ id: "c", name: "Saldo em Conta" })],
      investments: [inv("c", 800, "2026-09-10")],
      trades: [],
      today,
    });
    expect(alerts[0]).toMatchObject({ nivel: "media", acao: { kind: "investir", section: "hub", amount: 800 } });
    expect(alerts[0].titulo).toContain("19 dias");
  });

  it("não avisa saldo movimentado nesta semana", () => {
    const alerts = buildAlerts({ accounts: [account({ id: "c", name: "Saldo em Conta" })], investments: [inv("c", 800, "2026-09-25")], trades: [], today });
    expect(alerts).toEqual([]);
  });

  it("avisa teto da Turbo, vencimento próximo e vendas perto do limite de isenção", () => {
    const alerts = buildAlerts({
      accounts: [
        account({ id: "t", name: "Turbo", is_turbo: true, current_balance: 11000, max_rendimento: 10000 }),
        account({ id: "cdb", name: "CDB 2026", maturity: "2026-10-05" }),
      ],
      investments: [inv("cdb", 5000, "2025-10-05")],
      trades: [trade("PETR4", "venda", 16000, "2026-09-12"), trade("MXRF11", "venda", 9000, "2026-09-13")],
      today,
    });
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("teto-t");
    expect(alerts.find((a) => a.id === "vence-cdb")?.titulo).toContain("em 6 dias");
    expect(alerts.find((a) => a.id === "vendas-2026-09")?.titulo).toMatch(/Faltam R\$\s?4\.000/);
  });
});
