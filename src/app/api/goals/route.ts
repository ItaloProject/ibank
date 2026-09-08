import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import sql from "@/lib/db";

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ibank_session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET() {
  const payload = await getUser();
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await sql`
    SELECT goal_target, goal_deadline_year, goal_monthly_contribution
    FROM app_users WHERE user_id = ${payload.userId}
  `;
  return NextResponse.json(rows[0] ?? {});
}

export async function POST(request: Request) {
  const payload = await getUser();
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { goal_target, goal_deadline_year, goal_monthly_contribution } = await request.json();

  await sql`
    UPDATE app_users SET
      goal_target = ${goal_target ?? null},
      goal_deadline_year = ${goal_deadline_year ?? null},
      goal_monthly_contribution = ${goal_monthly_contribution ?? null}
    WHERE user_id = ${payload.userId}
  `;

  return NextResponse.json({ ok: true });
}
