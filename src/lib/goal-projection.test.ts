import { describe, expect, it } from "vitest";
import { projectGoal } from "./goal-projection";

const today = new Date(2026, 8, 29);

describe("projectGoal", () => {
  it("calcula capital, prazo no ritmo atual e aporte para o prazo desejado", () => {
    const p = projectGoal({ metaRendaMensal: 5000, patrimonio: 100_000, aporteMensal: 2000, retornoAnualPct: 10, ipcaAnualPct: 4, prazoAno: 2040, today })!;
    expect(p.rendimentoRealAnualPct).toBeCloseTo(5.77, 1);
    expect(p.capitalNecessario).toBeGreaterThan(1_000_000);
    expect(p.anoPrevisto).toBeGreaterThan(2040);
    expect(p.noPrazo).toBe(false);
    expect(p.aporteParaPrazo).toBeGreaterThan(2000);
  });

  it("meta já coberta e casos sem meta", () => {
    expect(projectGoal({ metaRendaMensal: 100, patrimonio: 1_000_000, aporteMensal: 0, retornoAnualPct: 10, ipcaAnualPct: 4, today })!.meses).toBe(0);
    expect(projectGoal({ metaRendaMensal: 0, patrimonio: 1, aporteMensal: 1, retornoAnualPct: 10, ipcaAnualPct: 4 })).toBeNull();
    expect(projectGoal({ metaRendaMensal: 5000, patrimonio: 0, aporteMensal: 0, retornoAnualPct: 10, ipcaAnualPct: 4, today })!.meses).toBeNull();
  });
});
