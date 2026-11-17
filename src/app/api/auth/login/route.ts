import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { ensureSessionColumns } from "@/lib/session";
import { ensureSubscriptionColumns } from "@/lib/subscription";
import { ensureOnboardingColumns } from "@/lib/onboarding";
import { bloqueioAtivo, chavesDeLogin, limparFalhas, mensagemBloqueio, registrarFalha } from "@/lib/login-limit";
import { abrirSessao } from "@/lib/server/abrir-sessao";
import { avisarBloqueioLogin } from "@/lib/server/alerta-login";

/** Hash de uma senha que ninguém usa: gasta o mesmo tempo quando o usuário não existe, para não revelar quem tem conta. */
const HASH_FALSO = "$2b$10$p9SNafGgWS7jkR/p89IXmOBKv373KorcKXc9kwVx4B55IiFXizQ2O";

export async function POST(request: Request) {
  try {
    const { username, password, force } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
    }
    if (typeof username !== "string" || typeof password !== "string" || password.length > 200) {
      return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 400 });
    }

    // Quem errou demais fica um tempo sem poder tentar, antes de gastar o bcrypt.
    const chaves = chavesDeLogin(username, request.headers);
    const segundos = await bloqueioAtivo(chaves);
    if (segundos > 0) {
      return NextResponse.json(
        { error: mensagemBloqueio(segundos), code: "LOGIN_BLOQUEADO" },
        { status: 429, headers: { "Retry-After": String(segundos) } },
      );
    }

    await ensureSubscriptionColumns();
    await ensureOnboardingColumns();
    await ensureSessionColumns();

    const rows = await sql`
      SELECT * FROM app_users WHERE username = ${username.toLowerCase().trim()}
    `;

    if (rows.length === 0) {
      await bcrypt.compare(password, HASH_FALSO);
      const bloqueadas = await registrarFalha(chaves);
      // Sem e-mail: não dá para avisar (e não revelamos se a conta existe).
      if (bloqueadas[0]) {
        avisarBloqueioLogin({ quem: username.toLowerCase().trim(), motivo: "login", chaveBloqueio: bloqueadas[0] });
      }
      return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      const bloqueadas = await registrarFalha(chaves);
      if (bloqueadas[0]) {
        avisarBloqueioLogin({
          email: typeof user.email === "string" ? user.email : null,
          quem: user.name || user.username || username,
          motivo: "login",
          chaveBloqueio: bloqueadas[0],
        });
      }
      return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
    }
    // Senha certa: zera as falhas desse usuário (as da origem continuam contando).
    await limparFalhas([chaves[0]]);

    if (user.is_active === false) {
      return NextResponse.json({ error: "Conta desativada. Fale conosco no WhatsApp." }, { status: 403 });
    }

    return await abrirSessao(request, user as never, force === true);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
