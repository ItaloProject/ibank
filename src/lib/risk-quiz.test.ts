import { describe, expect, it } from "vitest";
import { QUIZ_MAX_PONTOS, scoreQuiz } from "./risk-quiz";

describe("scoreQuiz", () => {
  it("classifica pelos pontos", () => {
    expect(scoreQuiz({ objetivo: "protecao", prazo: "1a3", queda: "vende_parte", experiencia: "basico", reserva: "ate3" })!.profile).toBe("conservador");
    expect(scoreQuiz({ objetivo: "renda_mensal", prazo: "3a10", queda: "espera", experiencia: "intermediario", reserva: "3a6" })!.profile).toBe("moderado");
    expect(scoreQuiz({ objetivo: "aposentadoria", prazo: "mais10", queda: "compra", experiencia: "avancado", reserva: "mais6" })!.profile).toBe("arrojado");
    expect(QUIZ_MAX_PONTOS).toBe(14);
  });

  it("aplica as travas de prazo curto e de quem venderia tudo", () => {
    expect(scoreQuiz({ objetivo: "aposentadoria", prazo: "ate1", queda: "compra", experiencia: "avancado", reserva: "mais6" })!.profile).toBe("conservador");
    expect(scoreQuiz({ objetivo: "aposentadoria", prazo: "mais10", queda: "vende_tudo", experiencia: "avancado", reserva: "mais6" })!.profile).toBe("moderado");
  });

  it("exige todas as respostas e explica o resultado", () => {
    expect(scoreQuiz({ objetivo: "aposentadoria" })).toBeNull();
    const r = scoreQuiz({ objetivo: "objetivo", prazo: "3a10", queda: "espera", experiencia: "nunca", reserva: "nenhuma" })!;
    expect(r.objetivo).toBe("objetivo");
    expect(r.motivos.length).toBeGreaterThan(0);
    expect(r.motivos.length).toBeLessThanOrEqual(3);
  });
});
