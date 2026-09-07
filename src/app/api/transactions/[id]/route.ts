import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { category } = await request.json();
    const rows = await sql`UPDATE transactions SET category = ${category} WHERE id = ${id} RETURNING *`;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[PATCH /api/transactions/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM transactions WHERE id = ${id}`;
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/transactions/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
