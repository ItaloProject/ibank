import { NextResponse } from "next/server";
import { getSession, signToken } from "@/lib/auth";
import { tokenPrecisaRenovar, VALIDADE_TOKEN_SEG } from "@/lib/token-renovacao";
import sql from "@/lib/db";
import { ensureSubscriptionColumns, hasBotAccess } from "@/lib/subscription";
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
             trial_ends_at, google_sub, active_session_id
      FROM app_users WHERE user_id = ${payload.userId}
    `;
    const user = rows[0];
    if (!user || user.is_active === false) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    if (!sessionMatches(user.active_session_id, payload.sid)) {
      return NextResponse.json({ user: null, code: "SESSION_REPLACED" }, { status: 401 });
    }

    const resposta = NextResponse.json({ user: dadosDoUsuario(user as never) });

    // Renova o token (mesmo login, mesma sessão) quando passa de 1 dia: quem usa o app pelo menos uma vez por semana
    // não é deslogado, e um token roubado ainda expira.
    if (tokenPrecisaRenovar(payload.iat)) {
      const token = await signToken({
        sid: payload.sid,
        userId: user.user_id,
        name: user.name,
        color: user.color,
        isAdmin: user.is_admin ?? false,
        investmentProfile: user.investment_profile ?? undefined,
        botEnabled: hasBotAccess(user),
      });
      resposta.cookies.set("ibank_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: VALIDADE_TOKEN_SEG,
        path: "/",
      });
    }
    return resposta;
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
        loginGoogle: false,
        dataExclusao: null,
        billingAccountId: null,
        billingDisponivel: false,
        trialActive: false,
        trialDaysLeft: 0,
      },
    });
  }
}
