import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { excluirContaDoUsuario } from "@/lib/conta";
import { bloqueioAtivo, chaveTrocaSenha, limparFalhas, mensagemBloqueio, registrarFalha } from "@/lib/login-limit";

/**
 * Exclui a conta e todos os dados do usuário. Exigido pelas lojas (Google Play e App Store):
 * quem cria conta no app precisa poder apagá-la pelo próprio app.
 * Contas com senha precisam digitar a senha; contas do Google confirmam digitando EXCLUIR.
 * Funciona mesmo com o teste acabado ou a assinatura vencida.
 */
export async function DELETE(request: Request) {
  const auth = await requireUserId({ permitirAssinaturaExpirada: true });
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const { confirmacao, senha } = await request.json().catch(() => ({}));
    if (confirmacao !== "EXCLUIR") {
      return NextResponse.json({ error: "Digite EXCLUIR para confirmar." }, { status: 400 });
    }

    const rows = await sql`SELECT password_hash, google_sub, is_admin FROM app_users WHERE user_id = ${userId}`;
    if (rows.length === 0) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    // A conta de administração não se apaga por aqui: evita ficar sem ninguém para administrar.
    if (rows[0].is_admin) {
      return NextResponse.json({ error: "A conta de administração não pode ser excluída por aqui." }, { status: 403 });
    }

    // Conta com senha: confirma a senha (com limite de tentativas, para uma sessão roubada não adivinhar).
    if (!rows[0].google_sub) {
      const chave = [chaveTrocaSenha(userId)];
      const segundos = await bloqueioAtivo(chave);
      if (segundos > 0) {
        return NextResponse.json(
          { error: mensagemBloqueio(segundos), code: "LOGIN_BLOQUEADO" },
          { status: 429, headers: { "Retry-After": String(segundos) } },
        );
      }
      const ok = typeof senha === "string" && senha.length > 0 && (await bcrypt.compare(senha, rows[0].password_hash));
      if (!ok) {
        await registrarFalha(chave);
        return NextResponse.json({ error: "Senha incorreta." }, { status: 400 });
      }
      await limparFalhas(chave);
    }

    // Todas as tabelas que guardam dados da pessoa, numa transação só (a mesma rotina da limpeza automática).
    await excluirContaDoUsuario(userId);

    // Registro mínimo, sem dado pessoal: só para saber quando e quantas contas foram excluídas.
    console.info("[conta-excluida]", createHash("sha256").update(`conta:${userId}`).digest("hex").slice(0, 12));

    const resposta = NextResponse.json({ ok: true });
    resposta.cookies.set("ibank_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
    return resposta;
  } catch (err) {
    console.error("[DELETE /api/account]", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente em instantes." }, { status: 500 });
  }
}

