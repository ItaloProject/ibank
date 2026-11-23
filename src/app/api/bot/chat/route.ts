import { NextResponse } from "next/server";
import { consumeDailyQuota, recordBotFeedback } from "@/lib/bot-schema";
import { feedbackText, looksUnanswered } from "@/lib/bot-feedback";
import { requireBotUser } from "@/lib/server/bot-auth";
import { localBotReply, type LocalMessage } from "@/lib/server/bot-local";
import { fetchMarketRates } from "@/lib/market-research";
import { FALLBACK_CDI } from "@/lib/investment-rates";
import { limitar } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_LIMIT = 60;
const MAX_TURNS = 12;

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

/** Assistente sem inteligência artificial: responde só com o conhecimento local (ver bot-local.ts). */
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

  try {
    const rates = await fetchMarketRates().catch(() => null);
    const cdi = rates?.cdiAnual ?? FALLBACK_CDI;
    const { text, answered, actions } = await localBotReply(messages, cdi);
    if (!answered || looksUnanswered(text)) {
      const question = feedbackText(messages[messages.length - 1].content);
      void recordBotFeedback(auth.userId, "sem_resposta", question, feedbackText(text)).catch(() => {});
    }
    return NextResponse.json({ reply: text, actions: actions ?? [] });
  } catch (err) {
    console.error("[POST /api/bot/chat]", err);
    return NextResponse.json({ error: "O assistente está indisponível agora. Tente de novo em instantes." }, { status: 502 });
  }
}
