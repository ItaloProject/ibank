import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { ensurePlanIncomeTable, parseIncomeInput, syncMonthTotal } from "@/lib/plan-income";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    const parsed = parseIncomeInput(await request.json());
    if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

    await ensurePlanIncomeTable();
    const rows = await sql`
      UPDATE plan_income SET description = ${parsed.description}, amount = ${parsed.amount}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING month
    `;
    if (!rows[0]) return NextResponse.json({ error: "Receita não encontrada" }, { status: 404 });
    const incomes = await syncMonthTotal(userId, String(rows[0].month));
    return NextResponse.json({ incomes });
  } catch (err) {
    console.error("[PATCH /api/plan-income/[id]]", err);
    return NextResponse.json({ error: "Erro ao atualizar receita" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;

    await ensurePlanIncomeTable();
    const rows = await sql`
      DELETE FROM plan_income WHERE id = ${id} AND user_id = ${userId}
      RETURNING month
    `;
    if (!rows[0]) return NextResponse.json({ error: "Receita não encontrada" }, { status: 404 });
    const incomes = await syncMonthTotal(userId, String(rows[0].month));
    return NextResponse.json({ incomes });
  } catch (err) {
    console.error("[DELETE /api/plan-income/[id]]", err);
    return NextResponse.json({ error: "Erro ao excluir receita" }, { status: 500 });
  }
}
