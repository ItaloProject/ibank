import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user") ?? "italo";

    const rows = await sql`
      SELECT goal_amount, saved_amount FROM savings_goals
      WHERE user_id = ${user}
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
    const { user_id = "italo", goal_amount = 0, saved_amount = 0 } = await request.json();
    await sql`
      INSERT INTO savings_goals (user_id, month, goal_amount, saved_amount)
      VALUES (${user_id}, 'geral', ${goal_amount}, ${saved_amount})
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
