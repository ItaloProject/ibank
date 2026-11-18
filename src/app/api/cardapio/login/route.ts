import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { signToken } from "@/lib/auth";
import { json, opcoes } from "@/lib/cardapio-acesso";
import { bloqueioAtivo, chavesDeLogin, limparFalhas, mensagemBloqueio, registrarFalha } from "@/lib/login-limit";
import { describeDevice, ensureSessionColumns, isSessionAlive } from "@/lib/session";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

const HASH_FALSO = "$2b$10$p9SNafGgWS7jkR/p89IXmOBKv373KorcKXc9kwVx4B55IiFXizQ2O";

/** Login do painel do cardápio: mesmo usuário/senha do Muvo; token com sid (mesma sessão única). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
    force?: boolean;
  };
  const { username, password, force } = body;
  if (!username || !password) return json({ error: "Preencha usuário e senha" }, 400);
  if (typeof username !== "string" || typeof password !== "string" || password.length > 200) {
    return json({ error: "Usuário ou senha incorretos" }, 401);
  }

  const chaves = chavesDeLogin(username, request.headers);
  const segundos = await bloqueioAtivo(chaves);
  if (segundos > 0) {
    return json({ error: mensagemBloqueio(segundos), code: "LOGIN_BLOQUEADO" }, 429);
  }

  await ensureSessionColumns();
  const rows = await sql`
    SELECT user_id, name, color, is_admin, is_active, password_hash,
           active_session_id, session_started_at, session_device
    FROM app_users WHERE username = ${username.toLowerCase().trim()}
  `;
  const user = rows[0];
  if (!user) {
    await bcrypt.compare(password, HASH_FALSO);
    await registrarFalha(chaves);
    return json({ error: "Usuário ou senha incorretos" }, 401);
  }
  if (!(await bcrypt.compare(password, user.password_hash as string))) {
    await registrarFalha(chaves);
    return json({ error: "Usuário ou senha incorretos" }, 401);
  }
  await limparFalhas([chaves[0]]);

  if (user.is_active === false) return json({ error: "Conta desativada. Fale com o administrador." }, 403);

  const active = user.active_session_id as string | null;
  if (active && !String(active).startsWith("revoked-") && isSessionAlive(user.session_started_at) && !force) {
    return json(
      {
        code: "SESSION_ACTIVE",
        error: "Esta conta já está conectada em outro dispositivo.",
        device: (user.session_device as string | null) ?? "outro dispositivo",
      },
      409,
    );
  }

  const sid = randomUUID().replace(/-/g, "");
  await sql`
    UPDATE app_users
    SET active_session_id = ${sid},
        session_device = ${describeDevice(request.headers.get("user-agent"))},
        session_started_at = NOW()
    WHERE user_id = ${user.user_id}
  `;

  const token = await signToken({
    sid,
    userId: user.user_id as string,
    name: user.name as string,
    color: (user.color as string) ?? "#3b82f6",
    isAdmin: Boolean(user.is_admin),
  });
  return json({ token, name: user.name, isAdmin: Boolean(user.is_admin) });
}

export const dynamic = "force-dynamic";
