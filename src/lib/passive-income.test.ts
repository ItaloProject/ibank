import { describe, expect, it } from "vitest";
import { aggregateProventos, computeMonthlyPassiveIncome } from "@/lib/passive-income";

describe("aggregateProventos", () => {
  it("soma o mesmo ticker e ignora valores inválidos", () => {
    expect(
      aggregateProventos([
        { ticker: "hglg11", amount: 80, payment_day: 15, type: "rendimento" },
        { ticker: "HGLG11", amount: 20, payment_day: 10, type: "rendimento" },
        { ticker: "PETR4", amount: 0 },
        { ticker: "", amount: 50 },
      ]),
    ).toEqual([
      { ticker: "HGLG11", amount: 100, payment_day: 10, type: "rendimento" },
    ]);
  });
});

describe("computeMonthlyPassiveIncome", () => {
  const accounts = [
    { id: "t1", name: "TURBO", is_turbo: true, cdi_percent: 100, current_balance: 10_000 },
    { id: "rf1", name: "CDB", is_turbo: false, current_balance: 0 },
  ];
  const investments = [
    { account_id: "rf1", type: "rendimento", amount: 50, date: "2026-01-15" },
    { account_id: "rf1", type: "rendimento", amount: 70, date: "2026-02-15" },
  ];
  const trades = [
    { ticker: "HGLG11", type: "compra", quantity: 10, total_amount: 10_000 },
    { ticker: "MXRF11", type: "compra", quantity: 20, total_amount: 2_000 },
    { ticker: "PETR4", type: "compra", quantity: 100, total_amount: 5_000 },
  ];

  it("usa heurística de FII/dividendo quando não há proventos cadastrados", () => {
    const { sources, total } = computeMonthlyPassiveIncome(accounts, investments, trades, 12);
    const fii = sources.find((s) => s.kind === "fii");
    const div = sources.find((s) => s.kind === "dividendo");
    expect(fii?.value).toBeCloseTo(12_000 * 0.0085, 5);
    expect(div?.value).toBeCloseTo(5_000 * 0.004, 5);
    expect(sources.find((s) => s.kind === "rf")?.value).toBeCloseTo(60, 5);
    expect(total).toBeGreaterThan(0);
  });

  it("provento cadastrado substitui a estimativa daquele ticker", () => {
    const { sources } = computeMonthlyPassiveIncome(accounts, investments, trades, 12, [
      { ticker: "HGLG11", amount: 85, payment_day: 12, type: "rendimento" },
    ]);
    const prov = sources.find((s) => s.kind === "provento" && s.label === "HGLG11");
    expect(prov).toMatchObject({ value: 85, origem: "registrado" });
    // MXRF11 continua na estimativa de FIIs; HGLG11 saiu
    const fii = sources.find((s) => s.kind === "fii");
    expect(fii?.value).toBeCloseTo(2_000 * 0.0085, 5);
    expect(sources.some((s) => s.label === "HGLG11" && s.kind === "fii")).toBe(false);
  });

  it("conta provento mesmo sem posição na carteira", () => {
    const { sources } = computeMonthlyPassiveIncome([], [], [], 12, [
      { ticker: "XPML11", amount: 40, payment_day: 5, type: "rendimento" },
    ]);
    expect(sources).toEqual([
      expect.objectContaining({ label: "XPML11", value: 40, origem: "registrado", kind: "provento" }),
    ]);
  });
});
