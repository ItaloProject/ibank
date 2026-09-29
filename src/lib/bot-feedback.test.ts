import { describe, expect, it } from "vitest";
import { feedbackText, looksUnanswered } from "./bot-feedback";

describe("bot feedback", () => {
  it("reconhece respostas em que a IA admite não saber", () => {
    expect(looksUnanswered("Não tenho essa informação nos seus dados. Cadastre a taxa no LIVE.")).toBe(true);
    expect(looksUnanswered("Faltam dados sobre seus gastos: preencha o Planejamento.")).toBe(true);
    expect(looksUnanswered("Sua reserva cobre **6 meses**. Aporte R$ 500 no Tesouro Selic.")).toBe(false);
  });

  it("limpa e limita o texto salvo", () => {
    expect(feedbackText("  oi \n  tudo ")).toBe("oi tudo");
    expect(feedbackText(42)).toBe("");
    expect(feedbackText("a".repeat(3000))).toHaveLength(2000);
  });
});
