import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import sql from "@/lib/db";
import { ensureSubscriptionColumns } from "@/lib/subscription";
import { ensureOnboardingColumns } from "@/lib/onboarding";
import { ensureSessionColumns, sessionMatches } from "@/lib/session";
import { dadosDoUsuario } from "@/lib/server/abrir-sessao";

export async function GET() {
  const payload = await getSession();
  if (!payload) return NextResponse.json({ user: null }, { status: 401 });

  try {
    await ensureSubscriptionColumns();
    await ensureOnboardingColumns();
    await ensureSessionColumns();
    const rows = await sql`
      SELECT user_id, name, color, is_admin, is_active, investment_profile,
             carteira_vista_profile, risk_profile, risk_quiz_at, bot_enabled, paid_until, plan,
             trial_ends_at, active_session_id
      FROM app_users WHERE user_id = ${payload.userId}
    `;
    const user = rows[0];
    if (!user || user.is_active === false) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    if (!sessionMatches(user.active_session_id, payload.sid)) {
      return NextResponse.json({ user: null, code: "SESSION_REPLACED" }, { status: 401 });
    }

    return NextResponse.json({ user: dadosDoUsuario(user as never) });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({
      user: {
        id: payload.userId,
        name: payload.name,
        color: payload.color,
        isAdmin: payload.isAdmin ?? false,
        investmentProfile: payload.investmentProfile ?? null,
        carteiraVista: true,
        botEnabled: payload.botEnabled ?? false,
        subscriptionActive: true,
        paidUntil: null,
        plan: "assinante",
        trialEndsAt: null,
        trialActive: false,
        trialDaysLeft: 0,
      },
    });
  }
}
