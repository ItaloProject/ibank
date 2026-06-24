import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM credit_cards ORDER BY created_at`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/cards]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, limit, closing_day, due_day } = await request.json();
    const rows = await sql`
      INSERT INTO credit_cards (name, "limit", closing_day, due_day)
      VALUES (${name}, ${limit}, ${closing_day}, ${due_day})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/cards]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
