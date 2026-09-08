import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import sql from "@/lib/db";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("ibank_session")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.userId ?? null;
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
