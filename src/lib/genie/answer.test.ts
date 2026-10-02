import { describe, expect, it } from "vitest";
import { answer, compound, findItem, guessType, installment, type PlanSnapshot } from "./answer";
import { parseGenie } from "./parse";

const S: PlanSnapshot = {
  month: "2026-09",
  monthLabel: "setembro 2026",
  salary: 5000,
  today: new Date(2026, 8, 21),
  groups: [{ id: "g1", name: "CASA" }, { id: "g2", name: "ALIMENTAÇÃO" }],
  items: [
    { id: "a", name: "Aluguel", groupId: "g1", type: "fixo", planned: 1800, actual: 1800 },
    { id: "b", name: "Mercado", groupId: "g2", type: "variavel", planned: 900, actual: 1100 },
    { id: "c", name: "Ifood", groupId: "g2", type: "variavel", planned: 300, actual: 100 },
  ],
};
const ask = (q: string) => answer(parseGenie(q, S.groups.map((g) => g.name), 14.9), S);

describe("respostas do Gênio", () => {
  it("fórmulas", () => {
    expect(compound(0, 500, 0.01, 12).fv).toBeCloseTo(6341.25, 2);
    expect(installment(10000, 12, 0.02).pmt).toBeCloseTo(945.6, 2);
    expect(installment(1200, 12, 0).pmt).toBe(100);
  });

  it("sobra e quanto dá para gastar por dia", () => {
    expect(ask("quanto sobra?")).toMatchObject({ raw: 2000, tone: "good" });
    // sobra 2000, ainda falta pagar 200 do Ifood; 10 dias do dia 21 ao 30
    expect(ask("quanto posso gastar por dia?")).toMatchObject({ raw: 180 });
  });

  it("gasto por grupo, itens estourados e corte", () => {
    expect(ask("quanto gastei em alimentação")).toMatchObject({ raw: 1200 });
    expect(ask("o que estourou?")?.lines).toEqual([{ label: "Mercado", value: expect.stringContaining("200"), tone: "bad" }]);
    expect(ask("se eu cortar 10% dos variáveis")).toMatchObject({ raw: 120 });
  });

  it("meta de economia compara com a sobra planejada", () => {
    const r = ask("quanto preciso guardar para juntar 12 mil em 12 meses");
    expect(r?.raw).toBe(1000);
    expect(r?.lines?.[1]).toMatchObject({ tone: "good" });
  });

  it("acha itens e adivinha o tipo", () => {
    expect(findItem("mercado", S.items)?.id).toBe("b");
    expect(findItem("ifood", S.items, "g1")).toBeNull();
    expect(guessType("Netflix", null)).toBe("fixo");
    expect(guessType("Padaria", null)).toBe("variavel");
    expect(guessType("Padaria", "fixo")).toBe("fixo");
  });
});
