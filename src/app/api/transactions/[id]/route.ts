import { NextResponse } from "next/server";
import sql from "@/lib/db";

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
