import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { ensurePlanGroupSchema } from "@/lib/plan-groups";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    const { month, done } = await request.json();
    if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month) || typeof done !== "boolean") {
      return NextResponse.json({ error: "Informe o mês (aaaa-mm) e se está feito" }, { status: 400 });
    }

    await ensurePlanGroupSchema();
    const rows = done
      ? await sql`
          UPDATE plan_groups
          SET done_months = CASE WHEN ${month}::text = ANY(done_months) THEN done_months ELSE array_append(done_months, ${month}::text) END
          WHERE id = ${id} AND user_id = ${userId} RETURNING done_months
        `
      : await sql`
          UPDATE plan_groups SET done_months = array_remove(done_months, ${month}::text)
          WHERE id = ${id} AND user_id = ${userId} RETURNING done_months
        `;
    if (!rows.length) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    await sql`UPDATE plan_items SET paid = ${done} WHERE group_id = ${id} AND user_id = ${userId} AND month = ${month}`;
    return NextResponse.json({ done_months: rows[0].done_months });
  } catch (err) {
    console.error("[PUT /api/plan-groups/[id]/done]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
