import { describe, expect, it } from "vitest";
import { computeLeftover, leftoverDescription, leftoverMonthOf, leftoverMonths, monthName } from "./plan-leftover";

describe("plan-leftover", () => {
  it("mês anterior e atual, inclusive na virada do ano", () => {
    expect(leftoverMonths(new Date(2026, 8, 30))).toEqual(["2026-08", "2026-09"]);
    expect(leftoverMonths(new Date(2027, 0, 5))).toEqual(["2026-12", "2027-01"]);
  });

  it("sobra é a renda menos os gastos reais", () => {
    expect(computeLeftover("2026-09", [4000, 807], [2360, 1200.5])).toEqual({ month: "2026-09", renda: 4807, gastoReal: 3560.5, sobra: 1246.5 });
  });

  it("descrição do lançamento identifica o mês trazido", () => {
    expect(leftoverMonthOf(leftoverDescription("2026-09"))).toBe("2026-09");
    expect(leftoverMonthOf("Ajuste de saldo via Live")).toBeNull();
    expect(monthName("2026-09")).toBe("setembro");
  });
});
