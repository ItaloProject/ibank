import { describe, expect, it } from "vitest";
import { financeReply, missingPeriodReply } from "@/lib/genie/local-answer";
import { parseFinance } from "@/lib/genie/finance-parse";

const CDI = 14.9;

describe("rendimento com CDI sem prazo", () => {
  it("pede o prazo para a pergunta da tela", () => {
    const a = missingPeriodReply("Quanto rendem 4 mil, com 100% CDI ?");
    expect(a).not.toBeNull();
    expect(a!.title).toBe("Falta o prazo para calcular");
  });

  it("com prazo em anos, calcula como CDB a 100% do CDI", () => {
    const cmd = parseFinance("quanto rendem 4 mil com 100% cdi em 2 anos");
    expect(cmd).toMatchObject({ kind: "netYield", amount: 4000, product: "cdb", pct: 100, months: 24 });
    expect(financeReply("quanto rendem 4 mil com 100% CDI em 2 anos", CDI)).not.toBeNull();
  });

  it("não pede prazo quando ele já foi dado", () => {
    expect(missingPeriodReply("quanto rendem 4 mil com 100% CDI em 30 dias")).toBeNull();
  });

  it("não responde perguntas sem valor, sem CDI ou sem o verbo de rendimento", () => {
    expect(missingPeriodReply("quanto rende o cdi hoje?")).toBeNull();
    expect(missingPeriodReply("quanto rende 10% ao ano")).toBeNull();
    expect(missingPeriodReply("quero aplicar 4 mil no cdb")).toBeNull();
    expect(missingPeriodReply("oi, tudo bem?")).toBeNull();
  });
});
