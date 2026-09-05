import { NextResponse } from "next/server";
import sql from "@/lib/db";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS score_history (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    TEXT NOT NULL,
      date       DATE NOT NULL,
      score      INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, date)
    )
  `;
}

export async function GET(request: Request) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user") ?? "italo";
    const rows = await sql`
      SELECT * FROM score_history
      WHERE user_id = ${user}
      ORDER BY date ASC
    `;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user") ?? "italo";
    const { date, score } = await request.json();
    const [row] = await sql`
      INSERT INTO score_history (user_id, date, score)
      VALUES (${user}, ${date}, ${score})
      ON CONFLICT (user_id, date)
      DO UPDATE SET score = ${score}
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
