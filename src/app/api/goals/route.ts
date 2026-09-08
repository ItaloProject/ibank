import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const rows = await sql`
    SELECT goal_target, goal_deadline_year, goal_monthly_contribution
    FROM app_users WHERE user_id = ${userId}
  `;
  return NextResponse.json(rows[0] ?? {});
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { goal_target, goal_deadline_year, goal_monthly_contribution } = await request.json();

  await sql`
    UPDATE app_users SET
      goal_target = ${goal_target ?? null},
      goal_deadline_year = ${goal_deadline_year ?? null},
      goal_monthly_contribution = ${goal_monthly_contribution ?? null}
    WHERE user_id = ${userId}
  `;

  return NextResponse.json({ ok: true });
}
