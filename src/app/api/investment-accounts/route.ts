import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { ensureAccountColumns } from "@/lib/account-schema";
import { validateAccountRate } from "@/lib/account-rate";

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensureAccountColumns();
    const rows = await sql`SELECT * FROM investment_accounts WHERE user_id = ${userId} ORDER BY created_at`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/investment-accounts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensureAccountColumns();
    const body = await request.json();
    const {
      name, institution,
      is_turbo = false, cdi_percent = null, max_rendimento = null, valor_liquido = null,
    } = body;

    let rate = null;
    if (body.rate_index != null) {
      const parsed = validateAccountRate(body);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      rate = parsed;
    }

    const rows = await sql`
      INSERT INTO investment_accounts (
        name, institution, current_balance, user_id, is_turbo, cdi_percent, max_rendimento, valor_liquido,
        rate_index, rate_value, maturity, tax_exempt
      )
      VALUES (
        ${name}, ${institution ?? ""}, 0, ${userId}, ${is_turbo}, ${cdi_percent}, ${max_rendimento}, ${valor_liquido},
        ${rate?.rate_index ?? null}, ${rate?.rate_value ?? null}, ${rate?.maturity ?? null}, ${rate?.tax_exempt ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/investment-accounts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
