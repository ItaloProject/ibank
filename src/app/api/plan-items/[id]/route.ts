import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    const { group_id, name, type, planned, actual } = await request.json();
    const rows = await sql`
      UPDATE plan_items
      SET group_id = ${group_id}, name = ${name}, type = ${type}, planned = ${planned}, actual = ${actual}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[PATCH /api/plan-items/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;
    await sql`DELETE FROM plan_items WHERE id = ${id} AND user_id = ${userId}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/plan-items/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
