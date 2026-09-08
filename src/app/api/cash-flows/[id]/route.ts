import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    const { description, type, amount, date } = await request.json();
    const month = String(date).slice(0, 7);
    const rows = await sql`
      UPDATE cash_flows
      SET description = ${description}, type = ${type}, amount = ${amount}, date = ${date}, month = ${month}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[PATCH /api/cash-flows/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    await sql`DELETE FROM cash_flows WHERE id = ${id} AND user_id = ${userId}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/cash-flows/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
