import { NextResponse } from "next/server";
import sql from "@/lib/db";

async function ensureTurboColumns() {
  await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS is_turbo BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS cdi_percent NUMERIC(6,2)`;
  await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS max_rendimento NUMERIC(12,2)`;
  await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(12,2)`;
}

export async function GET(request: Request) {
  try {
    await ensureTurboColumns();
    const user = new URL(request.url).searchParams.get("user") ?? "italo";
    const rows = await sql`SELECT * FROM investment_accounts WHERE user_id = ${user} ORDER BY created_at`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/investment-accounts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTurboColumns();
    const {
      name, institution, user_id = "italo",
      is_turbo = false, cdi_percent = null, max_rendimento = null, valor_liquido = null,
    } = await request.json();
    const rows = await sql`
      INSERT INTO investment_accounts (name, institution, current_balance, user_id, is_turbo, cdi_percent, max_rendimento, valor_liquido)
      VALUES (${name}, ${institution ?? ""}, 0, ${user_id}, ${is_turbo}, ${cdi_percent}, ${max_rendimento}, ${valor_liquido})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/investment-accounts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
