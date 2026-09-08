import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS turbo_monthly_records (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id   UUID NOT NULL,
      user_id      TEXT NOT NULL,
      month        TEXT NOT NULL,
      total_bruto  NUMERIC(12,2) NOT NULL,
      rendimento   NUMERIC(12,2) NOT NULL DEFAULT 0,
      valor_liquido NUMERIC(12,2),
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (account_id, month)
    )
  `;
}

export async function GET(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");
    if (!accountId) return NextResponse.json([]);
    const rows = await sql`
      SELECT * FROM turbo_monthly_records
      WHERE user_id = ${userId} AND account_id = ${accountId}
      ORDER BY month ASC
    `;
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
    const { account_id, month, total_bruto, rendimento, valor_liquido } = await request.json();
    const [row] = await sql`
      INSERT INTO turbo_monthly_records (account_id, user_id, month, total_bruto, rendimento, valor_liquido)
      VALUES (${account_id}, ${userId}, ${month}, ${total_bruto}, ${rendimento ?? 0}, ${valor_liquido ?? null})
      ON CONFLICT (account_id, month)
      DO UPDATE SET
        total_bruto   = ${total_bruto},
        rendimento    = ${rendimento ?? 0},
        valor_liquido = ${valor_liquido ?? null}
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
