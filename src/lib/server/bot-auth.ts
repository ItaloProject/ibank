import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/plans";
import { ensureSubscriptionColumns, isSubscriptionActive } from "@/lib/subscription";
import { testeAtivo } from "@/lib/trial";

/** Usuário logado, com assinatura ativa e o assistente liberado. */
export async function requireBotUser(): Promise<{ userId: string } | NextResponse> {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  await ensureSubscriptionColumns();
  const rows = await sql`
    SELECT is_admin, is_active, bot_enabled, paid_until, trial_ends_at, plan
    FROM app_users WHERE user_id = ${auth.userId}
  `;
  const row = rows[0];
  if (!row || !isSubscriptionActive(row)) {
    return NextResponse.json({ error: "O assistente Muvo não está liberado na sua assinatura." }, { status: 403 });
  }
  const ent = entitlementsFor({
    plan: row.plan as string | null,
    bot_enabled: row.bot_enabled as boolean | null,
    is_admin: row.is_admin as boolean | null,
    trialActive: testeAtivo(row.trial_ends_at as string | Date | null),
  });
  if (!ent.bot) {
    return NextResponse.json(
      { error: "O MUVO Bot está disponível no plano Completo.", code: "UPGRADE_REQUIRED" },
      { status: 403 },
    );
  }
  return auth;
}
