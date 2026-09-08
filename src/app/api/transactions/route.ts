import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const cardId = searchParams.get("card_id");
    const billingCycle = searchParams.get("billing_cycle");
    const afterCycle = searchParams.get("after_cycle"); // billing_cycle > afterCycle
    const listCycles = searchParams.get("list_cycles") === "true";

    // Return distinct billing cycles for a card
    if (listCycles && cardId) {
      const rows = await sql`
        SELECT DISTINCT billing_cycle FROM transactions
        WHERE user_id = ${userId} AND credit_card_id = ${cardId} AND billing_cycle IS NOT NULL
        ORDER BY billing_cycle DESC
      `;
      return NextResponse.json(rows.map((r) => r.billing_cycle));
    }

    let rows;
    if (afterCycle && cardId) {
      // Future committed installments (billing_cycle > afterCycle, only debits)
      rows = await sql`
        SELECT * FROM transactions
        WHERE user_id = ${userId} AND credit_card_id = ${cardId}
          AND billing_cycle > ${afterCycle} AND amount > 0
        ORDER BY billing_cycle ASC, date ASC
      `;
    } else if (billingCycle && cardId) {
      rows = await sql`
        SELECT * FROM transactions
        WHERE user_id = ${userId} AND credit_card_id = ${cardId} AND billing_cycle = ${billingCycle}
        ORDER BY date DESC, created_at DESC
      `;
    } else if (billingCycle) {
      // Dashboard: todos os cartões do usuário no ciclo atual
      rows = await sql`
        SELECT * FROM transactions
        WHERE user_id = ${userId} AND billing_cycle = ${billingCycle}
        ORDER BY date DESC, created_at DESC
      `;
    } else if (start && end && cardId) {
      rows = await sql`
        SELECT * FROM transactions
        WHERE user_id = ${userId} AND credit_card_id = ${cardId} AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC
      `;
    } else if (start && end) {
      rows = await sql`
        SELECT * FROM transactions
        WHERE user_id = ${userId} AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC
      `;
    } else if (cardId) {
      rows = await sql`
        SELECT * FROM transactions WHERE user_id = ${userId} AND credit_card_id = ${cardId} ORDER BY date DESC
      `;
    } else {
      rows = await sql`SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY date DESC`;
    }

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/transactions]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("card_id");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!cardId) return NextResponse.json({ error: "card_id obrigatório" }, { status: 400 });

    const billingCycleDelete = searchParams.get("billing_cycle");
    if (billingCycleDelete) {
      await sql`
        DELETE FROM transactions
        WHERE user_id = ${userId} AND credit_card_id = ${cardId} AND billing_cycle = ${billingCycleDelete}
      `;
    } else if (start && end) {
      await sql`
        DELETE FROM transactions
        WHERE user_id = ${userId} AND credit_card_id = ${cardId} AND date >= ${start} AND date <= ${end}
      `;
    } else {
      await sql`DELETE FROM transactions WHERE user_id = ${userId} AND credit_card_id = ${cardId}`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/transactions]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const body = await request.json();
    const rows: unknown[] = Array.isArray(body) ? body : [body];

    const inserted = await Promise.all(
      rows.map((row: unknown) => {
        const r = row as {
          credit_card_id: string; description: string; amount: number; category: string;
          date: string; installments?: number; installment_current?: number;
          billing_cycle?: string | null;
        };
        return sql`
          INSERT INTO transactions
            (credit_card_id, description, amount, category, date, installments, installment_current, user_id, billing_cycle)
          VALUES
            (${r.credit_card_id}, ${r.description}, ${r.amount}, ${r.category}, ${r.date},
             ${r.installments ?? 1}, ${r.installment_current ?? 1}, ${userId},
             ${r.billing_cycle ?? null})
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
