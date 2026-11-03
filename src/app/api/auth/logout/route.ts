import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import sql from "@/lib/db";
import { ensureSessionColumns } from "@/lib/session";

export async function POST() {
  // Libera a conta para o próximo login sem perguntar; só limpa se a sessão ainda for esta.
  try {
    const session = await getSession();
    if (session?.sid) {
      await ensureSessionColumns();
      await sql`
        UPDATE app_users
        SET active_session_id = NULL, session_device = NULL, session_started_at = NULL
        WHERE user_id = ${session.userId} AND active_session_id = ${session.sid}
      `;
    }
  } catch (err) {
    console.error("[POST /api/auth/logout]", err);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("ibank_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
