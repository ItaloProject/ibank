/**
 * Conjunto de avaliação do assistente. Cada caso é uma pergunta real ou típica e o que a resposta
 * precisa ter. Roda sem chave de IA: mede o motor local e as ferramentas de cálculo, que são o que
 * dá precisão aos números. Acrescente casos sempre que uma pergunta real falhar.
 */
import { describe, expect, it } from "vitest";
import { dayYieldReply } from "@/lib/genie/local-answer";
import { matchLocalPortfolio, type LocalPortfolio } from "@/lib/bot-local";
import { runBotTool } from "@/lib/bot-tools";

const CDI = 10;
const carteira = {
  grandTotal: 8000,
  totalRendaMensal: 137,
  incomeGoal: 130,
  bolsaResultado: -150,
  holdings: [{ ticker: "ITUB4", kind: "Ação", value: 160 }],
  sources: [{ nome: "TURBO", tipo: "Turbo", capital: 5000, rendaMensal: 60 }],
  alerts: [],
  hasEmergenciaCaixinha: false,
} as unknown as LocalPortfolio;

type Caso = { pergunta: string; deve: RegExp; motor: "dias" | "carteira" | "ferramenta"; args?: Record<string, unknown> };

/** Perguntas que o motor local precisa responder certo, com o trecho que a resposta tem de conter. */
const CASOS: Caso[] = [
  { pergunta: "Quanto me rende os 4000 mil em 30 dias?", motor: "dias", deve: /CDB a 100% do CDI, em 30 dias/ },
  { pergunta: "Se eu deixar 4 dias 4000 mil rendendo 100% CDI e resgatar, com quanto eu fico?", motor: "dias", deve: /em 4 dias/ },
  { pergunta: "quanto rende 10000 na LCI a 90% do CDI em 20 dias", motor: "dias", deve: /isento/ },
  { pergunta: "reserva", motor: "carteira", deve: /6 meses/ },
  { pergunta: "Emergência", motor: "carteira", deve: /6 meses/ },
  { pergunta: "Tesouro Selic ou CDB para a reserva?", motor: "carteira", deve: /Tesouro Selic/ },
  { pergunta: "quanto rende 10000 em 12 meses no CDB 100% do CDI", motor: "ferramenta", args: { valor: 10000, meses: 12, produto: "cdb", percentual_cdi: 100 }, deve: /10\.825,00/ },
  { pergunta: "quanto rende 10000 em 12 meses na LCI a 100% do CDI", motor: "ferramenta", args: { valor: 10000, meses: 12, produto: "lci", percentual_cdi: 100 }, deve: /11\.000,00/ },
];

describe("avaliação do assistente", () => {
  for (const caso of CASOS) {
    it(`${caso.motor}: ${caso.pergunta}`, () => {
      if (caso.motor === "dias") {
        const r = dayYieldReply(caso.pergunta, CDI);
        expect(r).not.toBeNull();
        expect(`${r!.answer.title}\n${r!.answer.lines!.map((l) => `${l.label}: ${l.value}`).join("\n")}`).toMatch(caso.deve);
      } else if (caso.motor === "carteira") {
        const r = matchLocalPortfolio(caso.pergunta, carteira);
        expect(r?.kind).toBe("text");
        if (r?.kind === "text") expect(r.text).toMatch(caso.deve);
      } else {
        const out = runBotTool("calcular_aplicacao_meses", caso.args, CDI);
        expect(out).toMatch(caso.deve);
      }
    });
  }

  it("não responde saudação com cálculo", () => {
    expect(dayYieldReply("oi, tudo bem?", CDI)).toBeNull();
  });
});
