import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { ensureOnboardingColumns } from "@/lib/onboarding";

export async function POST() {
  const auth = await requireUserId({ permitirAssinaturaExpirada: true });
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureOnboardingColumns();
    await sql`
      UPDATE app_users SET carteira_vista_profile = investment_profile
      WHERE user_id = ${auth.userId}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/carteira-vista]", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente em instantes." }, { status: 500 });
  }
}
