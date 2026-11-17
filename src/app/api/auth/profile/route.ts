import { NextResponse } from "next/server";
import { getSession, signToken } from "@/lib/auth";
import sql from "@/lib/db";
import { opcoesCookieSessao } from "@/lib/session-cookie";

export async function POST(request: Request) {
  const payload = await getSession();
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { profile } = await request.json();
  if (!["aposentadoria", "renda_mensal"].includes(profile)) {
    return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });
  }

  await sql`
    UPDATE app_users SET investment_profile = ${profile} WHERE user_id = ${payload.userId}
  `;

  const newToken = await signToken({
    sid: payload.sid,
    userId: payload.userId,
    name: payload.name,
    color: payload.color,
    isAdmin: payload.isAdmin,
    investmentProfile: profile,
    botEnabled: payload.botEnabled,
  });

  const response = NextResponse.json({ ok: true, profile });
  response.cookies.set("ibank_session", newToken, opcoesCookieSessao());
  return response;
}
