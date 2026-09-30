import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureOnboardingColumns } from "@/lib/onboarding";
import { isRiskProfile } from "@/lib/rebalance";
import { scoreQuiz, type QuizAnswers } from "@/lib/risk-quiz";
import { invalidateSnapshot } from "@/lib/server/portfolio-snapshot";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : null;
};

/**
 * Salva o questionário de perfil. O servidor recalcula o resultado; o usuário pode trocar o perfil sugerido (`profile`).
 * `skip: true` só registra que ele pulou, para não perguntar de novo.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  await ensureOnboardingColumns();
  const body = (await request.json().catch(() => null)) as
    | { skip?: boolean; answers?: QuizAnswers; profile?: unknown; aporte?: unknown; gasto?: unknown }
    | null;

  if (body?.skip) {
    await sql`UPDATE app_users SET risk_quiz_at = NOW() WHERE user_id = ${auth.userId}`;
    return NextResponse.json({ ok: true, skipped: true });
  }

  const result = body?.answers ? scoreQuiz(body.answers) : null;
  if (!result) return NextResponse.json({ error: "Responda todas as perguntas." }, { status: 400 });
  const profile = isRiskProfile(body?.profile) ? body.profile : result.profile;
  const aporte = money(body?.aporte);
  const gasto = money(body?.gasto);

  await sql`
    UPDATE app_users SET
      risk_profile = ${profile},
      investment_profile = ${result.objetivo},
      carteira_vista_profile = ${result.objetivo},
      risk_quiz_at = NOW(),
      declared_spending = COALESCE(${gasto}, declared_spending),
      goal_monthly_contribution = COALESCE(${aporte}, goal_monthly_contribution)
    WHERE user_id = ${auth.userId}
  `;
  invalidateSnapshot(auth.userId);
  return NextResponse.json({ ok: true, profile, objetivo: result.objetivo, sugerido: result.profile });
}
