import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    const rows = month
      ? await sql`
          SELECT * FROM cash_flows
          WHERE user_id = ${userId} AND month = ${month}
          ORDER BY date DESC, created_at DESC
        `
      : await sql`
          SELECT * FROM cash_flows
          WHERE user_id = ${userId}
          ORDER BY date DESC, created_at DESC
        `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/cash-flows]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { description, type, amount, date } = await request.json();
    const month = String(date).slice(0, 7);
    const rows = await sql`
      INSERT INTO cash_flows (user_id, month, description, type, amount, date)
      VALUES (${userId}, ${month}, ${description}, ${type}, ${amount ?? 0}, ${date})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/cash-flows]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
