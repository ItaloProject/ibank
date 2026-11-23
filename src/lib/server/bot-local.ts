import { findTerms, termMarkdown } from "@/lib/glossary";
import { dayYieldReply, financeReply, missingPeriodReply, withPendingPeriod } from "@/lib/genie/local-answer";
import { answerMarkdown } from "@/lib/genie/answer";
import { chatTopic, investorChatText, looksLikeWebQuestion } from "@/lib/genie/chat";
import { recall } from "@/lib/server/genie-knowledge";
import { keywordIntent, type Intent } from "@/lib/bot-intent";

export type LocalMessage = { role: "user" | "assistant"; content: string };
export type LocalAction = { kind: "investir" };
export type LocalReply = { text: string; answered: boolean; actions?: LocalAction[] };

/** Pergunta sobre a carteira da pessoa: não vai para a memória de pesquisas gerais. */
const PESSOAL = /\b(?:minha|meu|meus|minhas|tenho|carteira|aportei|investi)\b/i;

const AJUDA = `Posso ajudar sem inteligência artificial. Pergunte:

- **Um termo** (CDB, CDI, FII, Tesouro…): explico em linguagem simples.
- **Uma conta de rendimento**: "quanto rendem 4 mil com 100% CDI em 30 dias?"
- **Uma pergunta geral** que o Muvo já aprendeu numa pesquisa anterior.

Para os números da sua carteira, use as telas Investir e Metas.`;

/**
 * Pedidos que são telas do app (sem os números aqui): o app mostra o botão para abrir a tela.
 * Perguntas de compra ou venda ficam com a ajuda.
 */
const TELA: Partial<Record<Intent, { text: string; action?: LocalAction }>> = {
  visao: {
    text: "A visão da carteira (patrimônio, renda, nota e alertas) fica na tela **Investir**. Abra por lá para ver os seus números.",
    action: { kind: "investir" },
  },
  rebal: {
    text: "O plano de rebalanceamento fica na tela **Investir**, na opção **Rebalancear**.",
    action: { kind: "investir" },
  },
  fiis: {
    text: "Os fundos imobiliários ficam na tela **Investir**: em **Aplicar agora**, escolha **Fundos imobiliários**.",
    action: { kind: "investir" },
  },
  meta: { text: "Sua meta de renda fica na tela **Metas**." },
  avisos: { text: "Seus avisos ficam na tela **Avisos**." },
};

const COMPRA_VENDA = /\bvend|\bcompr|\bdevo\b|vale a pena/;

/** Pedido de uma tela do app, quando a pergunta não é de compra ou venda. */
function telaReply(last: string): LocalReply | null {
  if (COMPRA_VENDA.test(last.toLowerCase())) return null;
  const intent = keywordIntent(last);
  const tela = intent ? TELA[intent] : undefined;
  if (!tela) return null;
  return { text: tela.text, answered: true, actions: tela.action ? [tela.action] : [] };
}

/**
 * Resposta do assistente só com o que o Muvo já sabe fazer localmente, sem modelo de linguagem:
 * conversa curta, conta de rendimento, glossário e a memória de pesquisas gerais.
 * Segue a mesma ordem do assistente da tela (investor-bot.tsx).
 */
export async function localBotReply(messages: LocalMessage[], cdi: number): Promise<LocalReply> {
  const last = messages[messages.length - 1].content;
  const anterior = messages.slice(0, -1).reverse().find((m) => m.role === "user")?.content ?? null;

  // Prazo que chega na mensagem seguinte ("e 1 semana?") completa a pergunta de rendimento anterior.
  const pendente = anterior && missingPeriodReply(anterior) ? anterior : null;
  const full = withPendingPeriod(pendente, last);
  // Só um prazo ("e em 30 dias?") herda a aplicação da pergunta anterior.
  const diaAnterior = anterior ? dayYieldReply(anterior, cdi)?.cmd ?? null : null;

  const topic = chatTopic(last);
  if (topic) return { text: investorChatText(topic), answered: true };

  const byDays = dayYieldReply(full, cdi, diaAnterior);
  if (byDays) return { text: answerMarkdown(byDays.answer), answered: true };

  const terms = findTerms(last);
  if (terms.length) return { text: terms.map(termMarkdown).join("\n\n"), answered: true };

  const calc = financeReply(full, cdi) ?? missingPeriodReply(full);
  if (calc) return { text: answerMarkdown(calc), answered: true };

  if (looksLikeWebQuestion(last) && !PESSOAL.test(last)) {
    const known = await recall(last).catch(() => null);
    if (known) {
      return {
        text: `${known.answer}\n\nResposta que o Muvo aprendeu numa pesquisa anterior na web: pode conter erros.`,
        answered: true,
      };
    }
  }

  const tela = telaReply(last);
  if (tela) return tela;

  return { text: AJUDA, answered: false };
}
