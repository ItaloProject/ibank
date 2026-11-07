import { describe, expect, it } from "vitest";
import { dayYieldAnswer } from "@/lib/genie/local-answer";
import { parseFinance } from "@/lib/genie/finance-parse";
import { businessDaysOf, iofRate, netYieldDays } from "@/lib/finance-calc";

const CDI = 14.9;
const PERGUNTA = "Se eu deixar 4 dias 4000 mil rendendo 100% CDI e resgatar, com quanto eu fico ?";
/** Quarta-feira, 12h em Brasília. */
const QUARTA = new Date("2026-11-04T15:00:00Z");
/** Segunda-feira, 12h em Brasília. */
const SEGUNDA = new Date("2026-11-02T15:00:00Z");

describe("aplicação por dias", () => {
  it("responde a pergunta de 4 dias com o IOF do resgate", () => {
    const a = dayYieldAnswer(PERGUNTA, CDI);
    expect(a).not.toBeNull();
    expect(a!.title).toMatch(/^CDB a 100% do CDI, em 4 dias$/);
    expect(a!.value).toMatch(/4\.000,\d\d/);
    expect(a!.lines!.map((l) => l.label)).toContain("IOF (resgate em 4 dias)");
    expect(a!.lines!.find((l) => l.label.startsWith("IOF"))!.value).toMatch(/^− /);
  });

  it("considera 4000 mil como R$ 4.000 e avisa no texto", () => {
    expect(dayYieldAnswer(PERGUNTA, CDI)!.note).toContain('você escreveu "4000 mil"');
  });

  it("o valor final é o aplicado mais o que sobra depois de IOF e IR", () => {
    const r = netYieldDays(4000, 0.149, 4, false, { from: QUARTA });
    expect(r.final).toBeGreaterThanOrEqual(4000);
    expect(r.final).toBeLessThan(4000 + r.gross);
    expect(r.iofPct).toBe(0.86);
    expect(r.businessDays).toBe(3);
  });

  it("aceita outras frases e produtos", () => {
    expect(dayYieldAnswer("quanto rende 1000 em 10 dias no CDB a 110% do CDI", CDI)).not.toBeNull();
    expect(dayYieldAnswer("deixo 2 mil rendendo 100% do CDI por 15 dias, quanto fico?", CDI)).not.toBeNull();
    expect(dayYieldAnswer("se eu aplicar 500 por 3 dias no CDI, quanto tenho?", CDI)).not.toBeNull();
  });

  it("LCI não paga IR nem IOF", () => {
    const a = dayYieldAnswer("quanto rende 10000 em 20 dias na LCI a 90% do CDI", CDI);
    expect(a).not.toBeNull();
    expect(a!.lines!.map((l) => l.label)).not.toContain("IOF (resgate em 20 dias)");
    expect(a!.lines!.find((l) => l.label === "Imposto de Renda")!.value).toBe("isento");
  });

  it("aceita semanas", () => {
    const cmd = parseFinance("quanto rende 1000 em 2 semanas no cdi");
    expect(cmd).toMatchObject({ kind: "dayYield", days: 14, businessDays: null });
  });

  it("'dias úteis' conta exatamente os dias úteis pedidos", () => {
    const cmd = parseFinance("quanto rende 1000 em 4 dias uteis no cdi");
    expect(cmd).toMatchObject({ kind: "dayYield", businessDays: 4 });
    const a = dayYieldAnswer("quanto rende 1000 em 4 dias úteis no CDI", CDI);
    expect(a!.title).toContain("em 4 dias úteis");
  });

  it("poupança antes de 30 dias não rende", () => {
    const a = dayYieldAnswer("quanto rende 1000 em 10 dias na poupança", CDI);
    expect(a!.value).toMatch(/1\.000,00/);
    expect(a!.note).toContain("antes de 30 dias não rende");
  });

  it("muda com a taxa de CDI informada", () => {
    const q = "quanto rende 100000 em 10 dias no CDI";
    expect(dayYieldAnswer(q, 10)!.value).not.toBe(dayYieldAnswer(q, 20)!.value);
  });

  it("não mexe nos cálculos por meses", () => {
    expect(parseFinance("quanto rende 10000 no cdb a 100% do cdi em 2 anos")?.kind).toBe("netYield");
    expect(dayYieldAnswer("quanto rende 10000 no cdb a 100% do cdi em 2 anos", CDI)).toBeNull();
  });

  it("sem prazo em dias, não responde", () => {
    expect(dayYieldAnswer("quanto rende 1000 no cdi", CDI)).toBeNull();
  });
});

describe("IOF e dias úteis", () => {
  it("IOF cai a cada dia e zera no 30º", () => {
    expect(iofRate(1)).toBe(0.96);
    expect(iofRate(4)).toBe(0.86);
    expect(iofRate(29)).toBe(0.03);
    expect(iofRate(30)).toBe(0);
  });

  it("conta dias úteis a partir da data da aplicação", () => {
    expect(businessDaysOf(4, QUARTA)).toBe(3);
    expect(businessDaysOf(4, SEGUNDA)).toBe(4);
    expect(businessDaysOf(7, QUARTA)).toBe(5);
    expect(businessDaysOf(1, new Date("2026-11-07T15:00:00Z"))).toBe(0);
  });
});
