import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const cardId = searchParams.get("card_id");

    let rows;
    if (start && end && cardId) {
      rows = await sql`
        SELECT * FROM transactions
        WHERE credit_card_id = ${cardId} AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC
      `;
    } else if (start && end) {
      rows = await sql`
        SELECT * FROM transactions
        WHERE date >= ${start} AND date <= ${end}
        ORDER BY date DESC
      `;
    } else if (cardId) {
      rows = await sql`
        SELECT * FROM transactions WHERE credit_card_id = ${cardId} ORDER BY date DESC
      `;
    } else {
      rows = await sql`SELECT * FROM transactions ORDER BY date DESC`;
    }

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/transactions]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("card_id");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!cardId) {
      return NextResponse.json({ error: "card_id obrigatório" }, { status: 400 });
    }

    if (start && end) {
      await sql`
        DELETE FROM transactions
        WHERE credit_card_id = ${cardId} AND date >= ${start} AND date <= ${end}
      `;
    } else {
      await sql`DELETE FROM transactions WHERE credit_card_id = ${cardId}`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/transactions]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows: unknown[] = Array.isArray(body) ? body : [body];

    const inserted = await Promise.all(
      rows.map((row: unknown) => {
        const r = row as {
          credit_card_id: string;
          description: string;
          amount: number;
          category: string;
          date: string;
          installments?: number;
          installment_current?: number;
        };
        return sql`
          INSERT INTO transactions
            (credit_card_id, description, amount, category, date, installments, installment_current)
          VALUES
            (${r.credit_card_id}, ${r.description}, ${r.amount}, ${r.category}, ${r.date},
             ${r.installments ?? 1}, ${r.installment_current ?? 1})
          RETURNING *
        `;
      })
    );

    return NextResponse.json(inserted.flat(), { status: 201 });
  } catch (err) {
    console.error("[POST /api/transactions]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
