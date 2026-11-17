import { NextResponse } from "next/server";
import { getSession, signToken } from "@/lib/auth";
import { tokenPrecisaRenovar } from "@/lib/token-renovacao";
import { opcoesCookieSessao } from "@/lib/session-cookie";
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
      resposta.cookies.set("ibank_session", token, opcoesCookieSessao());
    }
    return resposta;
  } catch (err) {
    // Nunca inventar um usuário "assinante ativo": isso burlaria o gate se o banco falhasse.
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({ user: null, error: "Não foi possível validar a sessão." }, { status: 503 });
  }
}
