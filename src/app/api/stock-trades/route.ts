import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const rows = await sql`
      SELECT * FROM stock_trades
      WHERE user_id = ${userId}
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
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const {
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
        ${userId},
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
