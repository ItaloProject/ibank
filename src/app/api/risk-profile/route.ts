import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureBotSchema } from "@/lib/bot-schema";
import { isRiskProfile } from "@/lib/rebalance";
import { invalidateSnapshot } from "@/lib/server/portfolio-snapshot";

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  await ensureBotSchema();
  const rows = await sql`SELECT risk_profile FROM app_users WHERE user_id = ${auth.userId}`;
  const p = rows[0]?.risk_profile;
  return NextResponse.json({ profile: isRiskProfile(p) ? p : null });
}

export async function PUT(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  if (!isRiskProfile(body?.profile)) {
    return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
  }
  await ensureBotSchema();
  await sql`UPDATE app_users SET risk_profile = ${body.profile} WHERE user_id = ${auth.userId}`;
  invalidateSnapshot(auth.userId);
  return NextResponse.json({ profile: body.profile });
}
