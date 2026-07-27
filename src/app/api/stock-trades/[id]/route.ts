import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM stock_trades WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/stock-trades/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
