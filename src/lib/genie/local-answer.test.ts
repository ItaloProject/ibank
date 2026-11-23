import { describe, expect, it } from "vitest";
import { financeReply } from "./local-answer";

describe("financeReply (calculadora sem inteligência artificial)", () => {
  it("faz contas simples e porcentagens", () => {
    expect(financeReply("2 + 2", 14.65)?.value).toBe("4");
    expect(financeReply("quanto é 15% de 2000", 14.65)?.value).toBe("300");
    expect(financeReply("quanto é 300 - 20%", 14.65)?.value).toBe("240");
  });

  it("mantém as contas financeiras", () => {
    expect(financeReply("quanto rende 4000 a 100% do CDI em 30 dias", 14.65)).not.toBeNull();
  });
});
