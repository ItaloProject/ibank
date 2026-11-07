import { describe, expect, it } from "vitest";
import { conservativeGoal, projectGoal } from "@/lib/goal-projection";

const HOJE = new Date("2026-11-07T12:00:00Z");

describe("meta explicada: nominal, conservador e entradas do cálculo", () => {
  const base = projectGoal({
    metaRendaMensal: 200,
    patrimonio: 8500,
    aporteMensal: 1300,
    retornoAnualPct: 11.49,
    ipcaAnualPct: 4.5,
    today: HOJE,
  })!;

  it("guarda as entradas do cálculo", () => {
    expect(base).toMatchObject({ metaRendaMensal: 200, patrimonio: 8500, aporteMensal: 1300, ipcaAnualPct: 4.5, retornoNominalAnualPct: 11.49 });
  });

  it("valores de hoje: 200 por mês com ~6,7% reais ao ano pedem cerca de R$ 37 mil", () => {
    expect(base.rendimentoRealAnualPct).toBeCloseTo(6.68, 1);
    expect(base.capitalNecessario).toBeGreaterThan(36_000);
    expect(base.capitalNecessario).toBeLessThan(38_000);
  });

  it("valor nominal (sem descontar a inflação) pede bem menos: cerca de R$ 22 mil", () => {
    expect(base.capitalNominal).toBeGreaterThan(21_000);
    expect(base.capitalNominal).toBeLessThan(23_000);
    expect(base.capitalNominal!).toBeLessThan(base.capitalNecessario);
  });

  it("sem rendimento positivo, não há capital nominal", () => {
    const p = projectGoal({ metaRendaMensal: 200, patrimonio: 0, aporteMensal: 100, retornoAnualPct: -100, ipcaAnualPct: 4.5, today: HOJE });
    expect(p!.capitalNominal).toBeNull();
  });

  it("cenário conservador usa 85% do CDI e a mesma meta", () => {
    const cons = conservativeGoal(base, 13.65)!;
    expect(cons.retornoNominalAnualPct).toBeCloseTo(13.65 * 0.85, 6);
    expect(cons.metaRendaMensal).toBe(200);
    expect(cons.patrimonio).toBe(8500);
    expect(cons.aporteMensal).toBe(1300);
  });
});

import { detectIntent } from "@/lib/bot-intent";

describe("pedido de explicação da meta", () => {
  it("reconhece 'explique minha meta' digitado", () => {
    expect(detectIntent("explique minha meta")).toBe("explica_meta");
    expect(detectIntent("como é calculada a minha meta?")).toBe("explica_meta");
  });
  it("'quanto falta' continua sendo a meta de sempre", () => {
    expect(detectIntent("quanto falta para minha meta?")).toBe("meta");
  });
});
