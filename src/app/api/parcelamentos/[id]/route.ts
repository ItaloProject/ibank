import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { clearUpcomingInstallmentItems, ensureInstallmentSchema } from "@/lib/installments";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    const body = await request.json();
    const { paid_installments, description, total_amount, installments, start_date, plan_group_id } = body;

    // Full edit
    if (description !== undefined) {
      await ensureInstallmentSchema();
      const [row] = await sql`
        UPDATE installment_plans
        SET
          description      = ${description},
          total_amount     = ${total_amount},
          installments     = ${installments},
          paid_installments = ${paid_installments ?? 0},
          start_date       = ${start_date ?? null},
          plan_group_id    = ${plan_group_id ?? null}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
      if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
      await clearUpcomingInstallmentItems(userId, id);
      return NextResponse.json(row);
    }

    // Quick paid count update
    if (paid_installments === undefined) {
      return NextResponse.json({ error: "paid_installments obrigatório" }, { status: 400 });
    }
    const [row] = await sql`
      UPDATE installment_plans
      SET paid_installments = ${paid_installments}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error("[PATCH /api/parcelamentos/:id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    await clearUpcomingInstallmentItems(userId, id);
    await sql`DELETE FROM installment_plans WHERE id = ${id} AND user_id = ${userId}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/parcelamentos/:id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
