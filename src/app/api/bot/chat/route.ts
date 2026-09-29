import { NextResponse } from "next/server";
import { consumeDailyQuota } from "@/lib/bot-schema";
import { requireBotUser } from "@/lib/server/bot-auth";
import { getCachedSnapshot } from "@/lib/server/portfolio-snapshot";
import { completeChat, llmProvider, type ChatMessage } from "@/lib/server/llm";
import { buildBotSystemPrompt } from "@/lib/report/bot-prompt";
import { extractActions } from "@/lib/plan-view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_LIMIT = 60;
const MAX_TURNS = 12;

function parseMessages(body: unknown): ChatMessage[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m): m is ChatMessage => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim() !== "")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-MAX_TURNS);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs.length && msgs[msgs.length - 1].role === "user" ? msgs : null;
}

/** Contexto da tela enviado pelo app; limitado para não inflar o prompt. */
function parsePage(body: unknown): string | null {
  const page = (body as { page?: unknown })?.page;
  if (!page || typeof page !== "object" || Array.isArray(page)) return null;
  const json = JSON.stringify(page);
  return json.length <= 3000 ? json : null;
}

export async function POST(request: Request) {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  if (!llmProvider()) return NextResponse.json({ error: "IA não configurada", code: "no_llm" }, { status: 503 });

  const body = await request.json().catch(() => null);
  const messages = parseMessages(body);
  if (!messages) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  if (!(await consumeDailyQuota(auth.userId, "chat", DAILY_LIMIT))) {
    return NextResponse.json({ error: `Você chegou ao limite de ${DAILY_LIMIT} perguntas por dia. Volte amanhã.` }, { status: 429 });
  }

  try {
    const snap = await getCachedSnapshot(auth.userId, (body as { fresh?: unknown })?.fresh === true);
    const raw = await completeChat(buildBotSystemPrompt(snap, parsePage(body)), messages);
    const { text, actions } = extractActions(raw ?? "", snap.stocks.map((s) => s.ticker));
    return NextResponse.json({ reply: text || "Não consegui formular uma resposta. Pode reformular a pergunta?", actions });
  } catch (err) {
    console.error("[POST /api/bot/chat]", err);
    return NextResponse.json({ error: "O assistente está indisponível agora. Tente de novo em instantes." }, { status: 502 });
  }
}
