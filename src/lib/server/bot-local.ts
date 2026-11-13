import { findTerms, termMarkdown } from "@/lib/glossary";
import { dayYieldReply, financeReply, missingPeriodReply, withPendingPeriod } from "@/lib/genie/local-answer";
import { answerMarkdown } from "@/lib/genie/answer";
import { chatTopic, investorChatText, looksLikeWebQuestion } from "@/lib/genie/chat";
import { recall } from "@/lib/server/genie-knowledge";

export type LocalMessage = { role: "user" | "assistant"; content: string };
export type LocalReply = { text: string; answered: boolean };

/** Pergunta sobre a carteira da pessoa: não vai para a memória de pesquisas gerais. */
const PESSOAL = /\b(?:minha|meu|meus|minhas|tenho|carteira|aportei|investi)\b/i;

const AJUDA = `Posso ajudar sem inteligência artificial. Pergunte:

- **Um termo** (CDB, CDI, FII, Tesouro…): explico em linguagem simples.
- **Uma conta de rendimento**: "quanto rendem 4 mil com 100% CDI em 30 dias?"
- **Uma pergunta geral** que o Muvo já aprendeu numa pesquisa anterior.

Para os números da sua carteira, use as telas Investir e Metas.`;

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

  return { text: AJUDA, answered: false };
}
