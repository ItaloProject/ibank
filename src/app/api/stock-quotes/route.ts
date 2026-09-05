import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user") ?? "italo";
    const rows = await sql`SELECT * FROM stock_quotes WHERE user_id = ${user}`;
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
    const { ticker, current_price } = await request.json();

    const [row] = await sql`
      INSERT INTO stock_quotes (user_id, ticker, current_price, updated_at)
      VALUES (${user}, ${ticker}, ${current_price}, NOW())
      ON CONFLICT (user_id, ticker)
      DO UPDATE SET current_price = ${current_price}, updated_at = NOW()
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
