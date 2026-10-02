import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { consumeDailyQuota } from "@/lib/bot-schema";
import { voteAnswer } from "@/lib/server/genie-knowledge";

export const dynamic = "force-dynamic";

/** Voto numa resposta aprendida: "Não ajudou" tira a resposta da memória até ser pesquisada de novo. */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => null)) as { id?: unknown; vote?: unknown } | null;
  const id = Number(body?.id);
  const vote = body?.vote;
  if (!Number.isInteger(id) || id <= 0 || (vote !== "up" && vote !== "down")) {
    return NextResponse.json({ error: "Voto inválido." }, { status: 400 });
  }
  if (!(await consumeDailyQuota(auth.userId, "feedback", 100))) return NextResponse.json({ ok: false }, { status: 429 });
  await voteAnswer(id, vote);
  return NextResponse.json({ ok: true });
}
