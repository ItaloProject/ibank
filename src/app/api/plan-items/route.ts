import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user") ?? "italo";
    const month = searchParams.get("month");
    if (!month) return NextResponse.json({ error: "month obrigatório" }, { status: 400 });
    const rows = await sql`
      SELECT * FROM plan_items WHERE user_id = ${user} AND month = ${month} ORDER BY created_at
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/plan-items]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user_id = "italo", group_id, month, name, type, planned, actual } = await request.json();
    const rows = await sql`
      INSERT INTO plan_items (user_id, group_id, month, name, type, planned, actual)
      VALUES (${user_id}, ${group_id}, ${month}, ${name}, ${type}, ${planned ?? 0}, ${actual ?? 0})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/plan-items]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
