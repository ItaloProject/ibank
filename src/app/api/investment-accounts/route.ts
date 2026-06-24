import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = new URL(request.url).searchParams.get("user") ?? "italo";
    const rows = await sql`SELECT * FROM investment_accounts WHERE user_id = ${user} ORDER BY created_at`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/investment-accounts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, institution, user_id = "italo" } = await request.json();
    const rows = await sql`
      INSERT INTO investment_accounts (name, institution, current_balance, user_id)
      VALUES (${name}, ${institution ?? ""}, 0, ${user_id})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/investment-accounts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
