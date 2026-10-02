import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { consumeDailyQuota, recordBotFeedback } from "@/lib/bot-schema";
import { feedbackText } from "@/lib/bot-feedback";

export const dynamic = "force-dynamic";

/** Pedido que o Muvo Gênio não entendeu, para ensinar novas frases. Aparece em GET /api/bot/feedback. */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => null)) as { text?: unknown; fallback?: unknown } | null;
  const text = feedbackText(body?.text).slice(0, 300);
  if (!text) return NextResponse.json({ error: "Pedido vazio." }, { status: 400 });
  if (!(await consumeDailyQuota(auth.userId, "feedback", 100))) return NextResponse.json({ ok: false }, { status: 429 });
  await recordBotFeedback(auth.userId, "genio", text, feedbackText(body?.fallback).slice(0, 40));
  return NextResponse.json({ ok: true });
}
