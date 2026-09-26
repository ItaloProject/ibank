import { NextResponse } from "next/server";
import { consumeDailyQuota } from "@/lib/bot-schema";
import { requireBotUser } from "@/lib/server/bot-auth";
import { getCachedSnapshot } from "@/lib/server/portfolio-snapshot";
import { completeChat, llmProvider, type ChatMessage } from "@/lib/server/llm";
import { buildBotSystemPrompt } from "@/lib/report/bot-prompt";

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

export async function POST(request: Request) {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  if (!llmProvider()) return NextResponse.json({ error: "IA não configurada", code: "no_llm" }, { status: 503 });

  const messages = parseMessages(await request.json().catch(() => null));
  if (!messages) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  if (!(await consumeDailyQuota(auth.userId, "chat", DAILY_LIMIT))) {
    return NextResponse.json({ error: `Você chegou ao limite de ${DAILY_LIMIT} perguntas por dia. Volte amanhã.` }, { status: 429 });
  }

  try {
    const snap = await getCachedSnapshot(auth.userId);
    const reply = await completeChat(buildBotSystemPrompt(snap), messages);
    return NextResponse.json({ reply: reply || "Não consegui formular uma resposta. Pode reformular a pergunta?" });
  } catch (err) {
    console.error("[POST /api/bot/chat]", err);
    return NextResponse.json({ error: "O assistente está indisponível agora. Tente de novo em instantes." }, { status: 502 });
  }
}
