import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, signToken } from "@/lib/auth";
import sql from "@/lib/db";
import { bloqueioAtivo, chaveTrocaSenha, limparFalhas, mensagemBloqueio, registrarFalha } from "@/lib/login-limit";
import { describeDevice, ensureSessionColumns } from "@/lib/session";
import { opcoesCookieSessao } from "@/lib/session-cookie";
import { avisarBloqueioLogin } from "@/lib/server/alerta-login";

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

  const rows = await sql`
    SELECT password_hash, name, color, is_admin, investment_profile, bot_enabled, email
    FROM app_users WHERE user_id = ${payload.userId}
  `;
  if (!rows.length) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const user = rows[0];
  const valid = await bcrypt.compare(senhaAtual, user.password_hash as string);
  if (!valid) {
    const bloqueadas = await registrarFalha(chave);
    if (bloqueadas[0]) {
      avisarBloqueioLogin({
        email: typeof user.email === "string" ? user.email : null,
        quem: (user.name as string) || payload.name || payload.userId,
        motivo: "senha",
        chaveBloqueio: bloqueadas[0],
      });
    }
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
  }
  await limparFalhas(chave);

  // Nova senha + nova sessão: qualquer token antigo (outro aparelho ou roubado) deixa de valer.
  const sid = randomUUID().replace(/-/g, "");
  const hash = await bcrypt.hash(novaSenha, 12);
  await ensureSessionColumns();
  await sql`
    UPDATE app_users
    SET password_hash = ${hash},
        active_session_id = ${sid},
        session_device = ${describeDevice(request.headers.get("user-agent"))},
        session_started_at = NOW()
    WHERE user_id = ${payload.userId}
  `;

  const token = await signToken({
    sid,
    userId: payload.userId,
    name: (user.name as string) ?? payload.name,
    color: (user.color as string) ?? payload.color,
    isAdmin: Boolean(user.is_admin ?? payload.isAdmin),
    investmentProfile: (user.investment_profile as string | null) ?? payload.investmentProfile,
    botEnabled: Boolean(user.bot_enabled ?? payload.botEnabled),
  });

  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set("ibank_session", token, opcoesCookieSessao());
  return resposta;
}
