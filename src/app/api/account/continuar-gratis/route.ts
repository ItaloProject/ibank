import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { PLANO_GRATUITO } from "@/lib/plans";
import { ensureSubscriptionColumns, isSubscriptionActive } from "@/lib/subscription";
import { dadosDoUsuario } from "@/lib/server/abrir-sessao";

/**
 * Converte conta de teste vencida (ou sem assinatura) para o plano gratuito permanente.
 * Usado na Play Store / freemium: o usuário continua no app com limites, sem apagar dados.
 */
export async function POST() {
  const auth = await requireUserId({ permitirAssinaturaExpirada: true });
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureSubscriptionColumns();

  const rows = await sql`
    SELECT user_id, name, color, is_admin, is_active, investment_profile, carteira_vista_profile,
           risk_profile, risk_quiz_at, bot_enabled, paid_until, plan, google_sub, trial_ends_at,
           active_session_id, session_started_at, session_device
    FROM app_users WHERE user_id = ${userId}
  `;
  const user = rows[0];
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  // Já pago ou já gratuito: só devolve o estado atual.
  if (user.plan === PLANO_GRATUITO || isSubscriptionActive(user)) {
    return NextResponse.json({ ok: true, user: dadosDoUsuario(user as Parameters<typeof dadosDoUsuario>[0]), already: true });
  }

  await sql`
    UPDATE app_users
    SET plan = ${PLANO_GRATUITO},
        bot_enabled = false,
        paid_until = NULL
    WHERE user_id = ${userId}
  `;

  const atualizado = await sql`
    SELECT user_id, name, color, is_admin, is_active, investment_profile, carteira_vista_profile,
           risk_profile, risk_quiz_at, bot_enabled, paid_until, plan, google_sub, trial_ends_at,
           active_session_id, session_started_at, session_device
    FROM app_users WHERE user_id = ${userId}
  `;

  return NextResponse.json({ ok: true, user: dadosDoUsuario(atualizado[0] as Parameters<typeof dadosDoUsuario>[0]) });
}
