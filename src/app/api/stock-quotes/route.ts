import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS stock_quotes (
      user_id      TEXT NOT NULL,
      ticker       TEXT NOT NULL,
      current_price NUMERIC(12,4) NOT NULL,
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, ticker)
    )
  `;
}

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensureTable();
    const rows = await sql`SELECT * FROM stock_quotes WHERE user_id = ${userId}`;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensureTable();
    const { ticker, current_price } = await request.json();

    const [row] = await sql`
      INSERT INTO stock_quotes (user_id, ticker, current_price, updated_at)
      VALUES (${userId}, ${ticker}, ${current_price}, NOW())
      ON CONFLICT (user_id, ticker)
      DO UPDATE SET current_price = ${current_price}, updated_at = NOW()
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
