import { NextResponse } from "next/server";
import sql from "@/lib/db";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    TEXT NOT NULL,
      date       DATE NOT NULL,
      total      NUMERIC(14,2) NOT NULL,
      invested   NUMERIC(14,2) NOT NULL DEFAULT 0,
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
      SELECT * FROM portfolio_snapshots
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
    const { date, total, invested } = await request.json();
    const [row] = await sql`
      INSERT INTO portfolio_snapshots (user_id, date, total, invested)
      VALUES (${user}, ${date}, ${total}, ${invested})
      ON CONFLICT (user_id, date)
      DO UPDATE SET total = ${total}, invested = ${invested}
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
