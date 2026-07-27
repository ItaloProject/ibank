import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = new URL(request.url).searchParams.get("user") ?? "italo";
    const rows = await sql`
      SELECT * FROM stock_trades
      WHERE user_id = ${user}
      ORDER BY date DESC, created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/stock-trades]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const {
      user_id = "italo",
      ticker,
      type = "compra",
      quantity,
      price_per_share,
      total_amount,
      notes = "",
      date,
    } = await request.json();

    const rows = await sql`
      INSERT INTO stock_trades (user_id, ticker, type, quantity, price_per_share, total_amount, notes, date)
      VALUES (
        ${user_id},
        ${String(ticker).toUpperCase()},
        ${type},
        ${quantity},
        ${price_per_share},
        ${total_amount},
        ${notes},
        ${date}
      )
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/stock-trades]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
