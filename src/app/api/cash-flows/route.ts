import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user") ?? "italo";
    const month = searchParams.get("month");

    const rows = month
      ? await sql`
          SELECT * FROM cash_flows
          WHERE user_id = ${user} AND month = ${month}
          ORDER BY date DESC, created_at DESC
        `
      : await sql`
          SELECT * FROM cash_flows
          WHERE user_id = ${user}
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
    const { user_id = "italo", description, type, amount, date } = await request.json();
    const month = String(date).slice(0, 7);
    const rows = await sql`
      INSERT INTO cash_flows (user_id, month, description, type, amount, date)
      VALUES (${user_id}, ${month}, ${description}, ${type}, ${amount ?? 0}, ${date})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/cash-flows]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
