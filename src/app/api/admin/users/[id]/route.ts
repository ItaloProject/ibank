import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import sql from "@/lib/db";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ibank_session")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || !payload.isAdmin) return null;
  return payload;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (typeof body.is_active === "boolean") {
    await sql`UPDATE app_users SET is_active = ${body.is_active} WHERE id = ${id}`;
  }
  if (body.password) {
    const hash = await bcrypt.hash(body.password, 12);
    await sql`UPDATE app_users SET password_hash = ${hash} WHERE id = ${id}`;
  }
  if (body.name) {
    await sql`UPDATE app_users SET name = ${body.name} WHERE id = ${id}`;
  }
  if (body.color) {
    await sql`UPDATE app_users SET color = ${body.color} WHERE id = ${id}`;
  }

  const [user] = await sql`
    SELECT id, user_id, username, name, color, is_active, is_admin, created_at
    FROM app_users WHERE id = ${id}
  `;
  return NextResponse.json(user);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  await sql`DELETE FROM app_users WHERE id = ${id} AND is_admin = false`;
  return NextResponse.json({ ok: true });
}
