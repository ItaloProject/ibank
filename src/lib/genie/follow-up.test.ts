import { describe, expect, it } from "vitest";
import { dayYieldReply } from "@/lib/genie/local-answer";
import { matchLocalPortfolio, type LocalPortfolio } from "@/lib/bot-local";

const CDI = 14.9;
const ctx = { grandTotal: 0, totalRendaMensal: 0, incomeGoal: 0, holdings: [], sources: [], alerts: [], hasEmergenciaCaixinha: false } as unknown as LocalPortfolio;

describe("aplicação por dias: pergunta sem produto e sem taxa", () => {
  it("usa 100% do CDI quando nada foi citado", () => {
    const r = dayYieldReply("Quanto me rende os 4000 mil em 30 dias ?", CDI);
    expect(r).not.toBeNull();
    expect(r!.answer.title).toMatch(/CDB a 100% do CDI, em 30 dias/);
    expect(r!.answer.value).toMatch(/4\.0\d\d,\d\d/);
  });

  it("'e em 30 dias?' reaproveita a aplicação anterior", () => {
    const first = dayYieldReply("Se eu deixar 4 dias 4000 mil rendendo 100% CDI e resgatar, com quanto eu fico?", CDI);
    expect(first).not.toBeNull();
    const second = dayYieldReply("E em 30 dias ?,", CDI, first!.cmd);
    expect(second).not.toBeNull();
    expect(second!.cmd).toMatchObject({ amount: 4000, days: 30 });
    expect(second!.answer.title).toMatch(/em 30 dias/);
  });

  it("sem aplicação anterior, 'e em 30 dias?' não responde", () => {
    expect(dayYieldReply("E em 30 dias ?", CDI)).toBeNull();
  });

  it("pergunta com novo valor não herda a anterior", () => {
    const first = dayYieldReply("deixo 4000 rendendo por 4 dias", CDI);
    const other = dayYieldReply("e 2000 em 10 dias no cdb a 110% do cdi", CDI, first!.cmd);
    expect(other!.cmd).toMatchObject({ amount: 2000, days: 10 });
  });
});

describe("reserva e emergência sozinhas", () => {
  it("'reserva' e 'emergência' explicam a reserva", () => {
    for (const q of ["reserva", "Emergência", "reserva de emergência"]) {
      const p = matchLocalPortfolio(q, ctx);
      expect(p?.kind).toBe("text");
      if (p?.kind === "text") expect(p.text).toMatch(/6 meses/);
    }
  });
});
