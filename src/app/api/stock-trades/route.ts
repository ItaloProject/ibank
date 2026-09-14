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

    if (typeof ticker !== "string" || !ticker.trim()) {
      return NextResponse.json({ error: "ticker é obrigatório" }, { status: 400 });
    }
    if (type !== "compra" && type !== "venda") {
      return NextResponse.json({ error: "type inválido" }, { status: 400 });
    }
    const qtyNum = Number(quantity);
    const priceNum = Number(price_per_share);
    const totalNum = Number(total_amount);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return NextResponse.json({ error: "quantity deve ser um número positivo" }, { status: 400 });
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return NextResponse.json({ error: "price_per_share deve ser um número positivo" }, { status: 400 });
    }
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      return NextResponse.json({ error: "total_amount deve ser um número positivo" }, { status: 400 });
    }
    if (Math.abs(totalNum - qtyNum * priceNum) > Math.max(0.05, totalNum * 0.01)) {
      return NextResponse.json({ error: "total_amount não bate com quantity × price_per_share" }, { status: 400 });
    }
    if (typeof date !== "string" || !date) {
      return NextResponse.json({ error: "date é obrigatório" }, { status: 400 });
    }

    const tickerUpper = String(ticker).toUpperCase().trim();

    // Venda não pode exceder a posição atualmente registrada (bloqueia venda a descoberto via API direta).
    if (type === "venda") {
      const posRows = await sql`
        SELECT COALESCE(SUM(CASE WHEN type = 'venda' THEN -quantity ELSE quantity END), 0) AS qty
        FROM stock_trades WHERE user_id = ${userId} AND ticker = ${tickerUpper}
      `;
      const heldQty = Number(posRows[0]?.qty) || 0;
      if (qtyNum > heldQty + 0.0001) {
        return NextResponse.json(
          { error: `Você tem apenas ${heldQty} un. de ${tickerUpper}` },
          { status: 400 },
        );
      }
    }

    const rows = await sql`
      INSERT INTO stock_trades (user_id, ticker, type, quantity, price_per_share, total_amount, notes, date)
      VALUES (
        ${userId},
        ${tickerUpper},
        ${type},
        ${qtyNum},
        ${priceNum},
        ${totalNum},
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
