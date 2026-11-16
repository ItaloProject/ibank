import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import sql from "@/lib/db";
import { bloqueioAtivo, chaveTrocaSenha, limparFalhas, mensagemBloqueio, registrarFalha } from "@/lib/login-limit";

const TAMANHO_MINIMO_SENHA = 8;

export async function POST(request: Request) {
  const payload = await getSession();
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { senhaAtual, novaSenha } = await request.json();
  if (!senhaAtual || !novaSenha || typeof senhaAtual !== "string" || typeof novaSenha !== "string") {
    return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
  }
  if (novaSenha.length < TAMANHO_MINIMO_SENHA) {
    return NextResponse.json({ error: `Nova senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres` }, { status: 400 });
  }
  if (novaSenha.length > 200) {
    return NextResponse.json({ error: "Nova senha muito longa" }, { status: 400 });
  }
  if (novaSenha === senhaAtual) {
    return NextResponse.json({ error: "A nova senha precisa ser diferente da atual" }, { status: 400 });
  }

  // Alguém com a sessão roubada não pode ficar adivinhando a senha atual.
  const chave = [chaveTrocaSenha(payload.userId)];
  const segundos = await bloqueioAtivo(chave);
  if (segundos > 0) {
    return NextResponse.json(
      { error: mensagemBloqueio(segundos), code: "LOGIN_BLOQUEADO" },
      { status: 429, headers: { "Retry-After": String(segundos) } },
    );
  }

  const rows = await sql`SELECT password_hash FROM app_users WHERE user_id = ${payload.userId}`;
  if (!rows.length) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const valid = await bcrypt.compare(senhaAtual, rows[0].password_hash);
  if (!valid) {
    await registrarFalha(chave);
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
  }
  await limparFalhas(chave);

  const hash = await bcrypt.hash(novaSenha, 12);
  await sql`UPDATE app_users SET password_hash = ${hash} WHERE user_id = ${payload.userId}`;

  return NextResponse.json({ ok: true });
}
