import { describe, expect, it, vi } from "vitest";
import type { UserSnapshot } from "@/lib/server/portfolio-snapshot";

vi.mock("@/lib/market-research", () => ({ buildMarketResearch: async () => null }));
import { botContextFromSnapshot, portfolioReply } from "./bot-portfolio";
import { msgToMarkdown } from "@/lib/bot-markdown";

/** Snapshot mínimo: só as partes que a visão da carteira usa. */
function snapshotCom(over: Partial<UserSnapshot>): UserSnapshot {
  return {
    userId: "u1",
    nome: "Ana",
    profile: "moderado",
    profileDefinido: true,
    metaRenda: null,
    aporte: 1000,
    aporteOrigem: "padrao",
    gastoMensal: null,
    portfolio: null,
    plan: null,
    holdings: [],
    turbos: [],
    accounts: [],
    saldoEmConta: 0,
    stocks: [],
    movements: [],
    alerts: [],
    proventos: [],
    history: [],
    goal: null,
    rates: { selicAnual: 13.75, cdiAnual: 13.65, ipca12m: 4.5, source: "bcb", focus: undefined } as unknown as UserSnapshot["rates"],
    curve: {} as UserSnapshot["curve"],
    geradoEm: "2026-11-23T12:00:00.000Z",
    raw: { accounts: [], investments: [], trades: [], proventos: [] },
    ...over,
  };
}

describe("carteira no servidor (mesmo contexto do site)", () => {
  it("patrimônio = saldos das contas + valor das ações", () => {
    const s = snapshotCom({
      accounts: [{ nome: "Conta", instituicao: "", grupo: "saldo", saldo: 1000, turbo: null, taxa: null }],
      stocks: [{ ticker: "PETR4", tipo: "Ação", quantidade: 10, precoMedio: 30, precoAtual: 35, investido: 300, valorAtual: 350, resultado: 50, resultadoPct: 16.7 }],
    });
    const ctx = botContextFromSnapshot(s);
    expect(ctx.grandTotal).toBe(1350);
    expect(ctx.bolsaResultado).toBe(50);
    expect(ctx.holdings).toEqual([{ ticker: "PETR4", kind: "Ação", value: 350 }]);
  });

  it("a visão da carteira responde com o patrimônio e a renda em texto", async () => {
    const s = snapshotCom({
      accounts: [{ nome: "Conta", instituicao: "", grupo: "saldo", saldo: 1000, turbo: null, taxa: null }],
    });
    const texto = msgToMarkdown(await portfolioReply("visao", s, "visão da carteira"));
    expect(texto).toContain("Visão da carteira");
    expect(texto).toContain("Patrimônio");
    expect(texto).toMatch(/R\$\s1\.000,00/);
    expect(texto).not.toMatch(/Investir\*\*|abra por lá/i);
  });
});
