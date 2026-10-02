import { describe, expect, it } from "vitest";
import { canLearn, findKnown, isVolatile, knowledgeKey } from "./knowledge";

const known = [
  { id: 1, key: knowledgeKey("o que é CDB?") },
  { id: 2, key: knowledgeKey("vale a pena investir em Tesouro Selic") },
  { id: 3, key: knowledgeKey("qual a diferença entre CDB e LCI?") },
];

describe("memória de respostas", () => {
  it("reconhece a mesma pergunta escrita de outro jeito", () => {
    expect(findKnown("O que é um CDB", known)?.id).toBe(1);
    expect(findKnown("me explica o que é cdb", known)?.id).toBe(1);
    expect(findKnown("Vale a pena investir no tesouro selic?", known)?.id).toBe(2);
    expect(findKnown("diferença entre LCI e CDB", known)?.id).toBe(3);
  });

  it("não troca uma pergunta por outra parecida", () => {
    expect(findKnown("o que é LCI?", known)).toBeNull();
    expect(findKnown("vale a pena investir em CDB", known)).toBeNull();
    expect(findKnown("o que é", known)).toBeNull();
  });

  it("só aprende perguntas sem dados pessoais", () => {
    expect(canLearn("o que é CDB?")).toBe(true);
    expect(canLearn("vale a pena guardar 5000 na poupança")).toBe(false);
    expect(canLearn("meu email é ana@exemplo.com, o que faço")).toBe(false);
  });

  it("marca respostas que envelhecem", () => {
    expect(isVolatile("qual a Selic hoje?")).toBe(true);
    expect(isVolatile("cotação do dólar")).toBe(true);
    expect(isVolatile("o que é CDB?")).toBe(false);
  });
});
