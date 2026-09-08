import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { id } = await params;

    await sql`
      DELETE FROM proventos
      WHERE id = ${id} AND user_id = ${userId}
    `;

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/proventos/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
