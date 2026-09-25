import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import sql from "@/lib/db";
import { ensureOnboardingColumns } from "@/lib/onboarding";

export async function POST() {
  const payload = await getSession();
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureOnboardingColumns();
    await sql`
      UPDATE app_users SET carteira_vista_profile = investment_profile
      WHERE user_id = ${payload.userId}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/carteira-vista]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
