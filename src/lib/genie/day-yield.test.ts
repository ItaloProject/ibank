import { describe, expect, it } from "vitest";
import { dayYieldAnswer } from "@/lib/genie/local-answer";
import { parseFinance } from "@/lib/genie/finance-parse";
import { businessDaysOf, iofRate, netYieldDays } from "@/lib/finance-calc";

const CDI = 14.9;
const PERGUNTA = "Se eu deixar 4 dias 4000 mil rendendo 100% CDI e resgatar, com quanto eu fico ?";

describe("aplicação por dias", () => {
  it("responde a pergunta de 4 dias com o IOF do resgate", () => {
    const a = dayYieldAnswer(PERGUNTA, CDI);
    expect(a).not.toBeNull();
    expect(a!.title).toBe("CDB a 100% do CDI, em 4 dias");
    expect(a!.value).toMatch(/4\.000,\d\d/);
    expect(a!.lines!.map((l) => l.label)).toContain("IOF (resgate em 4 dias)");
    expect(a!.lines!.find((l) => l.label.startsWith("IOF"))!.value).toMatch(/^− /);
  });

  it("considera 4000 mil como R$ 4.000 e avisa no texto", () => {
    const a = dayYieldAnswer(PERGUNTA, CDI);
    expect(a!.note).toContain('você escreveu "4000 mil"');
  });

  it("o valor final é o aplicado mais o que sobra depois de IOF e IR", () => {
    const r = netYieldDays(4000, 0.149, 4, false);
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

  it("converte dias corridos em úteis (5 a cada 7)", () => {
    expect(businessDaysOf(4)).toBe(3);
    expect(businessDaysOf(7)).toBe(5);
    expect(businessDaysOf(1)).toBe(1);
  });
});
