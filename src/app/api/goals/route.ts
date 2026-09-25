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

  const body = (await request.json()) ?? {};
  // Só altera os campos enviados: a página Metas salva apenas a meta, sem apagar prazo e aporte.
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

  await sql`
    UPDATE app_users SET
      goal_target = CASE WHEN ${has("goal_target")} THEN ${body.goal_target ?? null} ELSE goal_target END,
      goal_deadline_year = CASE WHEN ${has("goal_deadline_year")} THEN ${body.goal_deadline_year ?? null} ELSE goal_deadline_year END,
      goal_monthly_contribution = CASE WHEN ${has("goal_monthly_contribution")} THEN ${body.goal_monthly_contribution ?? null} ELSE goal_monthly_contribution END
    WHERE user_id = ${userId}
  `;

  return NextResponse.json({ ok: true });
}
