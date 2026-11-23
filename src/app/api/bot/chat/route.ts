import { NextResponse } from "next/server";
import { consumeDailyQuota, recordBotFeedback } from "@/lib/bot-schema";
import { feedbackText, looksUnanswered } from "@/lib/bot-feedback";
import { detectIntent, keywordIntent, type Intent } from "@/lib/bot-intent";
import { msgToMarkdown } from "@/lib/bot-markdown";
import { requireBotUser } from "@/lib/server/bot-auth";
import { localBotReply, type LocalMessage } from "@/lib/server/bot-local";
import { botContextFromSnapshot, localPortfolioHit, PORTFOLIO_INTENTS, portfolioReply } from "@/lib/server/bot-portfolio";
import { getCachedSnapshot } from "@/lib/server/portfolio-snapshot";
import { fetchMarketRates } from "@/lib/market-research";
import { FALLBACK_CDI } from "@/lib/investment-rates";
import { limitar } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_LIMIT = 60;
const MAX_TURNS = 12;

/** Pergunta que pode falar da carteira da pessoa: só nesses casos o servidor carrega o snapshot. */
const SOBRE_CARTEIRA = /\b(minha|meu|minhas|meus|tenho|quanto|carteira|renda|reserva|turbo|caixinha|saldo|bolsa|fiis?|acoes|patrimonio|aviso|alerta|meta|rebalanc|aporte|onde|visao|resumo|score|proventos?|dividend\w*|prejuizo|resultado|vender|fazer|proxima|comeco|ajuda|fixa|prefixad)\b|\b[a-z]{4}\d{1,2}\b/;

function norm(raw: string): string {
  return raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function parseMessages(body: unknown): LocalMessage[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m): m is LocalMessage => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim() !== "")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-MAX_TURNS);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs.length && msgs[msgs.length - 1].role === "user" ? msgs : null;
}

/**
 * Assistente sem inteligência artificial, com as mesmas respostas do site: os números da carteira
 * vêm do snapshot da pessoa, e o resto (glossário, contas, memória) das respostas locais.
 */
export async function POST(request: Request) {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;

  // Limite curto além da cota diária: evita rajada que satura o servidor.
  const rajada = await limitar({ chave: `bot-chat:${auth.userId}`, max: 20, janelaSeg: 60 });
  if (!rajada.ok) {
    return NextResponse.json(
      { error: "Muitas perguntas em pouco tempo. Espere um instante." },
      { status: 429, headers: { "Retry-After": String(rajada.retryAfter) } },
    );
  }

  const body = await request.json().catch(() => null);
  const messages = parseMessages(body);
  if (!messages) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  if (!(await consumeDailyQuota(auth.userId, "chat", DAILY_LIMIT))) {
    return NextResponse.json({ error: `Você chegou ao limite de ${DAILY_LIMIT} perguntas por dia. Volte amanhã.` }, { status: 429 });
  }

  const pergunta0 = messages[messages.length - 1].content;
  const userId0 = auth.userId;

  try {
    const last = pergunta0;
    const intent = detectIntent(last);

    // Pedido direto de uma tela da carteira: a resposta traz os números da pessoa.
    if (PORTFOLIO_INTENTS.includes(intent)) {
      const s = await getCachedSnapshot(auth.userId);
      return ok(msgToMarkdown(await portfolioReply(intent, s, last)), true);
    }

    // Pergunta aberta sobre a carteira: o mesmo atalho de números que o site usa antes das respostas gerais.
    if (intent === "help" && SOBRE_CARTEIRA.test(norm(last))) {
      const s = await getCachedSnapshot(auth.userId);
      const hit = localPortfolioHit(last, botContextFromSnapshot(s));
      if (hit?.kind === "text") return ok(hit.text, true);
      if (hit?.kind === "intent" && PORTFOLIO_INTENTS.includes(hit.intent)) {
        return ok(msgToMarkdown(await portfolioReply(hit.intent, s, last)), true);
      }
    }

    const rates = await fetchMarketRates().catch(() => null);
    const cdi = rates?.cdiAnual ?? FALLBACK_CDI;
    const local = await localBotReply(messages, cdi);
    if (local.answered) return ok(local.text, true);

    // Último recurso: palavra-chave de uma tela da carteira.
    const kw: Intent | null = keywordIntent(last);
    if (kw && PORTFOLIO_INTENTS.includes(kw)) {
      const s = await getCachedSnapshot(auth.userId);
      return ok(msgToMarkdown(await portfolioReply(kw, s, last)), true);
    }

    return ok(local.text, false);
  } catch (err) {
    console.error("[POST /api/bot/chat]", err);
    return NextResponse.json({ error: "O assistente está indisponível agora. Tente de novo em instantes." }, { status: 502 });
  }

  function ok(text: string, answered: boolean) {
    if (!answered || looksUnanswered(text)) {
      const pergunta = feedbackText(pergunta0);
      void recordBotFeedback(userId0, "sem_resposta", pergunta, feedbackText(text)).catch(() => {});
    }
    return NextResponse.json({ reply: text, actions: [] });
  }
}
