import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureSubscriptionColumns, hasBotAccess, isSubscriptionActive } from "@/lib/subscription";

/** Usuário logado, com assinatura ativa e o assistente liberado. */
export async function requireBotUser(): Promise<{ userId: string } | NextResponse> {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  await ensureSubscriptionColumns();
  const rows = await sql`SELECT is_admin, is_active, bot_enabled, paid_until FROM app_users WHERE user_id = ${auth.userId}`;
  const row = rows[0];
  if (!row || !isSubscriptionActive(row) || !hasBotAccess(row)) {
    return NextResponse.json({ error: "O assistente Muvo não está liberado na sua assinatura." }, { status: 403 });
  }
  return auth;
}
