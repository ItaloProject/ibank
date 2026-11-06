import { describe, expect, it } from "vitest";
import { matchLocalPortfolio, type LocalPortfolio } from "./bot-local";

const ctx: LocalPortfolio = {
  grandTotal: 7993.75,
  totalRendaMensal: 137.33,
  incomeGoal: 130,
  bolsaResultado: -175.34,
  holdings: [
    { ticker: "VALE3", kind: "Ação", value: 120.5 },
    { ticker: "TRXF11", kind: "FII", value: 125.6 },
    { ticker: "ITUB4", kind: "Ação", value: 76.98 },
  ],
  sources: [
    { nome: "TURBO", tipo: "Turbo", capital: 5110.96, rendaMensal: 63 },
    { nome: "Saldo em conta", tipo: "Saldo", capital: 123.02, rendaMensal: 0 },
    { nome: "Prefixado", tipo: "Renda Fixa", capital: 1190.4, rendaMensal: 69.88 },
  ],
  alerts: [{ id: "teto-1", titulo: "TURBO passou do teto em R$ 111", nivel: "media" }],
};

describe("matchLocalPortfolio", () => {
  it("responde patrimônio e renda", () => {
    const p = matchLocalPortfolio("qual meu patrimônio?", ctx);
    expect(p?.kind).toBe("text");
    if (p?.kind === "text") expect(p.text).toMatch(/7\.993,75/);

    const r = matchLocalPortfolio("quanto eu recebo de renda passiva?", ctx);
    expect(r?.kind).toBe("text");
    if (r?.kind === "text") expect(r.text).toMatch(/137,33/);
  });

  it("explica bolsa negativa e lista posições", () => {
    const b = matchLocalPortfolio("por que minha bolsa está negativa?", ctx);
    expect(b?.kind).toBe("text");
    if (b?.kind === "text") expect(b.text).toMatch(/negativo/);

    const lista = matchLocalPortfolio("quanto tenho na bolsa?", ctx);
    expect(lista?.kind).toBe("text");
    if (lista?.kind === "text") {
      expect(lista.text).toMatch(/VALE3/);
      expect(lista.text).toMatch(/TRXF11/);
    }
  });

  it("reconhece Turbo, saldo e ticker", () => {
    expect(matchLocalPortfolio("quanto tenho na turbo?", ctx)?.kind).toBe("text");
    expect(matchLocalPortfolio("quanto tem na conta?", ctx)?.kind).toBe("text");
    const t = matchLocalPortfolio("e a VALE3?", ctx);
    expect(t?.kind).toBe("text");
    if (t?.kind === "text") expect(t.text).toMatch(/VALE3/);
  });

  it("manda para avisos ou rebalancear quando a pessoa não sabe o que fazer", () => {
    expect(matchLocalPortfolio("o que fazer agora?", ctx)).toEqual({ kind: "intent", intent: "avisos" });
    expect(matchLocalPortfolio("por onde começo?", { ...ctx, alerts: [] })).toEqual({
      kind: "intent",
      intent: "rebal",
    });
  });

  it("responde Tesouro Selic vs CDB na reserva sem cair no menu genérico", () => {
    const hit = matchLocalPortfolio("Qual eu utilizo Tesouro Selic ou CDB com liquidez diaria?", ctx);
    expect(hit?.kind).toBe("text");
    if (hit?.kind === "text") {
      expect(hit.text).toMatch(/Tesouro Selic/i);
      expect(hit.text).toMatch(/CDB/i);
      expect(hit.text).toMatch(/[Nn]ão use poupança|Evite poupança|não é indicada/);
      expect(hit.text).not.toMatch(/caixinha \*\*Emergência\*\*|caixinha Emergência/);
    }

    const comEme = matchLocalPortfolio("Qual eu utilizo Tesouro Selic ou CDB com liquidez diaria?", {
      ...ctx,
      hasEmergenciaCaixinha: true,
    });
    expect(comEme?.kind).toBe("text");
    if (comEme?.kind === "text") expect(comEme.text).toMatch(/caixinha \*\*Emergência\*\*/);

    const poup = matchLocalPortfolio("vale a pena deixar a reserva na poupança?", ctx);
    expect(poup?.kind).toBe("text");
    if (poup?.kind === "text") expect(poup.text).toMatch(/Não use poupança/i);
  });
});
