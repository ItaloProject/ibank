import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { ensureAccountColumns } from "@/lib/account-schema";
import { validateAccountRate } from "@/lib/account-rate";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    const body = await request.json();

    // Rentabilidade contratada (indexador, taxa, vencimento, isenção)
    if (body.rate_index !== undefined) {
      await ensureAccountColumns();
      if (body.rate_index === null) {
        const rows = await sql`
          UPDATE investment_accounts
          SET rate_index = NULL, rate_value = NULL, maturity = NULL, tax_exempt = NULL
          WHERE id = ${id} AND user_id = ${userId} RETURNING *
        `;
        return rows[0] ? NextResponse.json(rows[0]) : NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
      }
      const rate = validateAccountRate(body);
      if ("error" in rate) return NextResponse.json({ error: rate.error }, { status: 400 });
      const rows = await sql`
        UPDATE investment_accounts
        SET rate_index = ${rate.rate_index}, rate_value = ${rate.rate_value},
            maturity = ${rate.maturity}, tax_exempt = ${rate.tax_exempt}
        WHERE id = ${id} AND user_id = ${userId} RETURNING *
      `;
      return rows[0] ? NextResponse.json(rows[0]) : NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    // Rename + optional TURBO settings
    if (body.name !== undefined) {
      const rows = await sql`
        UPDATE investment_accounts
        SET name = ${body.name}, institution = ${body.institution ?? null}
        WHERE id = ${id} AND user_id = ${userId} RETURNING *
      `;
      return NextResponse.json(rows[0]);
    }

    // Update TURBO settings only
    if (body.is_turbo !== undefined || body.valor_liquido !== undefined) {
      const isTurbo = body.is_turbo ?? null;
      const cdiPct = body.cdi_percent ?? null;
      const maxRend = body.max_rendimento ?? null;
      const liquido = body.valor_liquido ?? null;
      const rows = await sql`
        UPDATE investment_accounts
        SET
          is_turbo       = ${isTurbo},
          cdi_percent    = ${cdiPct},
          max_rendimento = ${maxRend},
          valor_liquido  = ${liquido}
        WHERE id = ${id} AND user_id = ${userId} RETURNING *
      `;
      return NextResponse.json(rows[0]);
    }

    // Update balance only
    const rows = await sql`
      UPDATE investment_accounts SET current_balance = ${body.current_balance}
      WHERE id = ${id} AND user_id = ${userId} RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[PATCH /api/investment-accounts/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    await sql`DELETE FROM investments WHERE account_id = ${id} AND user_id = ${userId}`;
    await sql`DELETE FROM investment_accounts WHERE id = ${id} AND user_id = ${userId}`;
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/investment-accounts/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
