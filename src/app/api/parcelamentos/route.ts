import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS installment_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL DEFAULT 'italo',
      description TEXT NOT NULL,
      total_amount NUMERIC(12,2) NOT NULL,
      installments INTEGER NOT NULL,
      paid_installments INTEGER NOT NULL DEFAULT 0,
      start_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensureTable();
    const rows = await sql`
      SELECT * FROM installment_plans
      WHERE user_id = ${userId}
      ORDER BY
        CASE WHEN paid_installments >= installments THEN 1 ELSE 0 END,
        created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/parcelamentos]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensureTable();
    const body = await request.json();
    const { description, total_amount, installments, paid_installments = 0, start_date } = body;

    if (!description || !total_amount || !installments) {
      return NextResponse.json({ error: "Campos obrigatórios: description, total_amount, installments" }, { status: 400 });
    }

    const [row] = await sql`
      INSERT INTO installment_plans (user_id, description, total_amount, installments, paid_installments, start_date)
      VALUES (${userId}, ${description}, ${total_amount}, ${installments}, ${paid_installments}, ${start_date ?? null})
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[POST /api/parcelamentos]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
