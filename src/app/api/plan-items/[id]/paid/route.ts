import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { ensurePlanGroupSchema } from "@/lib/plan-groups";

/** Marca o item como pago e mantém o grupo coerente: todos pagos deixa o grupo feito no mês, um pendente tira. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    const { paid } = await request.json();
    if (typeof paid !== "boolean") return NextResponse.json({ error: "Informe se o item está pago" }, { status: 400 });

    await ensurePlanGroupSchema();
    const [item] = await sql`
      UPDATE plan_items SET paid = ${paid} WHERE id = ${id} AND user_id = ${userId}
      RETURNING group_id, month
    `;
    if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

    const [{ pending }] = await sql`
      SELECT COUNT(*)::int AS pending FROM plan_items
      WHERE group_id = ${item.group_id} AND user_id = ${userId} AND month = ${item.month} AND NOT paid
    `;
    const month = String(item.month);
    const [group] = pending === 0
      ? await sql`
          UPDATE plan_groups
          SET done_months = CASE WHEN ${month}::text = ANY(done_months) THEN done_months ELSE array_append(done_months, ${month}::text) END
          WHERE id = ${item.group_id} AND user_id = ${userId} RETURNING done_months
        `
      : await sql`
          UPDATE plan_groups SET done_months = array_remove(done_months, ${month}::text)
          WHERE id = ${item.group_id} AND user_id = ${userId} RETURNING done_months
        `;
    return NextResponse.json({ paid, done_months: group?.done_months ?? [] });
  } catch (err) {
    console.error("[PUT /api/plan-items/[id]/paid]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
