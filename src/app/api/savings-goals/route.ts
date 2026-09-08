import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const rows = await sql`
      SELECT goal_amount, saved_amount FROM savings_goals
      WHERE user_id = ${userId}
      ORDER BY CASE WHEN month = 'geral' THEN 0 ELSE 1 END, month DESC
      LIMIT 1
    `;
    return NextResponse.json({
      goal_amount: rows[0] ? Number(rows[0].goal_amount) : 0,
      saved_amount: rows[0] ? Number(rows[0].saved_amount) : 0,
    });
  } catch (err) {
    console.error("[GET /api/savings-goals]", err);
    return NextResponse.json({ goal_amount: 0, saved_amount: 0 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { goal_amount = 0, saved_amount = 0 } = await request.json();
    await sql`
      INSERT INTO savings_goals (user_id, month, goal_amount, saved_amount)
      VALUES (${userId}, 'geral', ${goal_amount}, ${saved_amount})
      ON CONFLICT (user_id, month) DO UPDATE SET
        goal_amount = ${goal_amount},
        saved_amount = ${saved_amount}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/savings-goals]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
