import { describe, expect, it } from "vitest";
import { buildCurve, neutralRate } from "./market-curve";

const start = new Date(2026, 8, 25); // setembro de 2026
const focus = {
  data: "2026-09-18",
  selic: [
    { ano: 2026, valor: 13.5 },
    { ano: 2027, valor: 12 },
    { ano: 2028, valor: 10.5 },
  ],
  ipca: [
    { ano: 2026, valor: 4.9 },
    { ano: 2027, valor: 4.3 },
    { ano: 2028, valor: 3.8 },
  ],
};

describe("curva de juros", () => {
  it("passa pela Selic do Focus em dezembro de cada ano", () => {
    const c = buildCurve({ selic: 15, cdi: 14.9, ipca12m: 5, focus }, 60, start);
    expect(c.source).toBe("focus");
    expect(c.selic[0]).toBe(15);
    expect(c.selic[3]).toBeCloseTo(13.5, 10); // dez/2026
    expect(c.selic[15]).toBeCloseTo(12, 10); // dez/2027
    expect(c.selic[9]).toBeCloseTo(12.75, 10); // meio do caminho
    expect(c.selic[59]).toBeCloseTo(10.5, 10); // depois do Focus, estável
  });

  it("mantém a diferença atual entre CDI e Selic", () => {
    const c = buildCurve({ selic: 15, cdi: 14.9, ipca12m: 5, focus }, 24, start);
    expect(c.selic[10] - c.cdi[10]).toBeCloseTo(0.1, 10);
  });

  it("usa o IPCA do Focus do ano de cada mês", () => {
    const c = buildCurve({ selic: 15, cdi: 14.9, ipca12m: 5, focus }, 60, start);
    expect(c.ipca[0]).toBe(4.9); // set/2026
    expect(c.ipca[4]).toBe(4.3); // jan/2027
    expect(c.ipca[40]).toBe(3.8); // 2030: último valor
  });

  it("sem Focus, converge ao juro neutro em 3 anos", () => {
    const c = buildCurve({ selic: 15, cdi: 14.9, ipca12m: 4 }, 60, start);
    expect(c.source).toBe("neutro");
    expect(c.cdi[36]).toBeCloseTo(neutralRate(4), 10);
    expect(c.ipca[20]).toBe(4);
  });
});
