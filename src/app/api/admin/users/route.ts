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

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const rows = await sql`
    SELECT id, user_id, username, name, color, is_active, is_admin, created_at
    FROM app_users ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { username, name, password, color, is_admin } = await request.json();
  if (!username || !name || !password) {
    return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const user_id = username.toLowerCase().trim().replace(/\s+/g, "_");

  try {
    const [user] = await sql`
      INSERT INTO app_users (user_id, username, name, password_hash, color, is_admin)
      VALUES (${user_id}, ${username.toLowerCase().trim()}, ${name}, ${hash}, ${color ?? "#3b82f6"}, ${is_admin ?? false})
      RETURNING id, user_id, username, name, color, is_active, is_admin, created_at
    `;
    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });
  }
}
