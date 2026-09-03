import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { paid_installments, description, total_amount, installments, start_date } = body;

    // Full edit
    if (description !== undefined) {
      const [row] = await sql`
        UPDATE installment_plans
        SET
          description      = ${description},
          total_amount     = ${total_amount},
          installments     = ${installments},
          paid_installments = ${paid_installments ?? 0},
          start_date       = ${start_date ?? null}
        WHERE id = ${id}
        RETURNING *
      `;
      if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
      return NextResponse.json(row);
    }

    // Quick paid count update
    if (paid_installments === undefined) {
      return NextResponse.json({ error: "paid_installments obrigatório" }, { status: 400 });
    }
    const [row] = await sql`
      UPDATE installment_plans
      SET paid_installments = ${paid_installments}
      WHERE id = ${id}
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
    const { id } = await params;
    await sql`DELETE FROM installment_plans WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/parcelamentos/:id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
