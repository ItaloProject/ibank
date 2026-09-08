import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { verifyToken } from "@/lib/auth";
import sql from "@/lib/db";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("ibank_session")?.value;
  if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const { senhaAtual, novaSenha } = await request.json();
  if (!senhaAtual || !novaSenha) {
    return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
  }
  if (novaSenha.length < 6) {
    return NextResponse.json({ error: "Nova senha deve ter pelo menos 6 caracteres" }, { status: 400 });
  }

  const rows = await sql`SELECT password_hash FROM app_users WHERE user_id = ${payload.userId}`;
  if (!rows.length) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const valid = await bcrypt.compare(senhaAtual, rows[0].password_hash);
  if (!valid) return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });

  const hash = await bcrypt.hash(novaSenha, 12);
  await sql`UPDATE app_users SET password_hash = ${hash} WHERE user_id = ${payload.userId}`;

  return NextResponse.json({ ok: true });
}
