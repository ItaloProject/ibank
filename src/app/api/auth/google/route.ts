import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import sql from "@/lib/db";
import { ensureSessionColumns } from "@/lib/session";
import { ensureSubscriptionColumns } from "@/lib/subscription";
import { ensureOnboardingColumns } from "@/lib/onboarding";
import { bloqueioAtivo, chavesDeLogin, mensagemBloqueio, registrarFalha } from "@/lib/login-limit";
import { abrirSessao } from "@/lib/server/abrir-sessao";
import { avisarBloqueioLogin } from "@/lib/server/alerta-login";
import { idsDeClienteGoogle, usuarioInternoDe, verificarIdTokenGoogle } from "@/lib/server/google-auth";
import { fimDoTeste, PLANO_TESTE } from "@/lib/trial";

/**
 * Entrar com o Google. Recebe o ID token (do app Android ou do botão do site).
 * Conta já ligada a esse Google: entra. Conta nova: cria com 3 dias de teste grátis.
 * Se o e-mail já pertence a uma conta com usuário e senha, NÃO liga sozinho (evita tomar a conta de outra pessoa).
 */
export async function POST(request: Request) {
  try {
    const clientIds = idsDeClienteGoogle();
    if (clientIds.length === 0) {
      return NextResponse.json({ error: "Entrar com o Google ainda não está disponível." }, { status: 503 });
    }

    const { idToken, force } = await request.json();
    if (typeof idToken !== "string" || !idToken) {
      return NextResponse.json({ error: "Não foi possível validar sua conta Google." }, { status: 400 });
    }

    // Só a chave da origem (IP): quem manda tokens inválidos em série é barrado.
    const chaves = [chavesDeLogin("google", request.headers)[1]];
    const segundos = await bloqueioAtivo(chaves);
    if (segundos > 0) {
      return NextResponse.json(
        { error: mensagemBloqueio(segundos), code: "LOGIN_BLOQUEADO" },
        { status: 429, headers: { "Retry-After": String(segundos) } },
      );
    }

    const perfil = await verificarIdTokenGoogle(idToken, clientIds);
    if (!perfil) {
      const bloqueadas = await registrarFalha(chaves);
      // Token inválido em série: avisa só o admin (não há conta confiável neste ponto).
      if (bloqueadas[0]) {
        avisarBloqueioLogin({ quem: "google-token", motivo: "login", chaveBloqueio: bloqueadas[0] });
      }
      return NextResponse.json({ error: "Não foi possível validar sua conta Google." }, { status: 401 });
    }

    await ensureSubscriptionColumns();
    await ensureOnboardingColumns();
    await ensureSessionColumns();

    const existentes = await sql`SELECT * FROM app_users WHERE google_sub = ${perfil.sub}`;
    if (existentes.length > 0) {
      const user = existentes[0];
      if (user.is_active === false) {
        return NextResponse.json({ error: "Conta desativada. Fale conosco." }, { status: 403 });
      }
      return await abrirSessao(request, user as never, force === true);
    }

    // E-mail já usado por outra conta (usuário e senha): não liga sozinho.
    const mesmoEmail = await sql`SELECT user_id FROM app_users WHERE lower(email) = ${perfil.email} LIMIT 1`;
    if (mesmoEmail.length > 0) {
      return NextResponse.json(
        {
          code: "EMAIL_JA_CADASTRADO",
          error: "Já existe uma conta com este e-mail. Entre com seu usuário e senha.",
        },
        { status: 409 },
      );
    }

    // Conta nova com 3 dias de teste. A senha é aleatória e ninguém a conhece: a entrada é pelo Google.
    const senhaInutilizavel = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    const fim = fimDoTeste();
    let criada: Record<string, unknown> | undefined;
    for (let tentativa = 0; tentativa < 3 && !criada; tentativa++) {
      const usuario = usuarioInternoDe(perfil.email, randomBytes(3).toString("hex"));
      try {
        const rows = await sql`
          INSERT INTO app_users (
            user_id, username, name, password_hash, is_active, is_admin,
            bot_enabled, plan, paid_until, trial_ends_at, email, google_sub, terms_accepted_at
          ) VALUES (
            ${usuario}, ${usuario}, ${perfil.nome}, ${senhaInutilizavel}, true, false,
            true, ${PLANO_TESTE}, NULL, ${fim.toISOString()}, ${perfil.email}, ${perfil.sub}, NOW()
          )
          RETURNING *
        `;
        criada = rows[0];
      } catch (err) {
        // Nome interno repetido: tenta de novo com outro sufixo. Qualquer outro erro sobe.
        if (!String(err).includes("duplicate key")) throw err;
        if (String(err).includes("google_sub")) {
          // Duas chamadas ao mesmo tempo para o mesmo Google: a outra criou, então entra por ela.
          const outra = await sql`SELECT * FROM app_users WHERE google_sub = ${perfil.sub}`;
          criada = outra[0];
        }
      }
    }
    if (!criada) {
      return NextResponse.json({ error: "Erro interno. Tente novamente em instantes." }, { status: 500 });
    }
    return await abrirSessao(request, criada as never, false);
  } catch (err) {
    console.error("[POST /api/auth/google]", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente em instantes." }, { status: 500 });
  }
}
