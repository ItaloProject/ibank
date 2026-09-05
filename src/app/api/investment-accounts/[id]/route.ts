import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Rename + optional TURBO settings
    if (body.name !== undefined) {
      const rows = await sql`
        UPDATE investment_accounts
        SET name = ${body.name}, institution = ${body.institution ?? null}
        WHERE id = ${id} RETURNING *
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
        WHERE id = ${id} RETURNING *
      `;
      return NextResponse.json(rows[0]);
    }

    // Update balance only
    const rows = await sql`
      UPDATE investment_accounts SET current_balance = ${body.current_balance} WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[PATCH /api/investment-accounts/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM investments WHERE account_id = ${id}`;
    await sql`DELETE FROM investment_accounts WHERE id = ${id}`;
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/investment-accounts/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
