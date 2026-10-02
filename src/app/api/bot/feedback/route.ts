import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { consumeDailyQuota, ensureBotSchema, recordBotFeedback } from "@/lib/bot-schema";
import { FEEDBACK_KINDS, feedbackText, type FeedbackKind } from "@/lib/bot-feedback";
import { requireBotUser } from "@/lib/server/bot-auth";

export const dynamic = "force-dynamic";

/** 👍/👎 numa resposta do bot, ou pergunta que ele não soube responder. */
export async function POST(request: Request) {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => null)) as { kind?: unknown; question?: unknown; answer?: unknown } | null;
  const kind = body?.kind as FeedbackKind;
  const question = feedbackText(body?.question);
  if (!FEEDBACK_KINDS.includes(kind) || !question) return NextResponse.json({ error: "Retorno inválido." }, { status: 400 });
  if (!(await consumeDailyQuota(auth.userId, "feedback", 100))) return NextResponse.json({ ok: false }, { status: 429 });
  await recordBotFeedback(auth.userId, kind, question, feedbackText(body?.answer));
  return NextResponse.json({ ok: true });
}

/** Painel para ensinar o bot: contagem dos últimos 30 dias e as perguntas que falharam. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  await ensureBotSchema();
  const [counts, pending, grouped] = await Promise.all([
    sql`
      SELECT kind, COUNT(*)::int AS n FROM bot_feedback
      WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY kind
    `,
    sql`
      SELECT kind, question, answer, created_at FROM bot_feedback
      WHERE kind IN ('down', 'sem_resposta', 'genio') ORDER BY created_at DESC LIMIT 50
    `,
    sql`
      SELECT LOWER(TRIM(question)) AS pergunta,
             COUNT(*)::int AS vezes,
             COUNT(DISTINCT user_id)::int AS pessoas,
             ARRAY_AGG(DISTINCT kind) AS tipos,
             BOOL_OR(kind = 'genio' AND answer = 'web') AS internet,
             MAX(created_at) AS ultima
      FROM bot_feedback
      WHERE kind IN ('down', 'sem_resposta', 'genio') AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY LOWER(TRIM(question))
      ORDER BY vezes DESC, ultima DESC
      LIMIT 100
    `,
  ]);
  return NextResponse.json({
    ultimos30Dias: Object.fromEntries(counts.map((r) => [r.kind, r.n])),
    paraEnsinar: pending.map((r) => ({ tipo: r.kind, pergunta: r.question, resposta: r.answer, em: r.created_at })),
    porPergunta: grouped.map((r) => ({
      pergunta: r.pergunta,
      vezes: r.vezes,
      pessoas: r.pessoas,
      tipos: r.tipos,
      internet: Boolean(r.internet),
      ultima: r.ultima,
    })),
  });
}
