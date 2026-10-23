import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { signToken } from "@/lib/auth";
import { json, opcoes } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

// Login do painel do cardápio: mesmo usuário e senha do Muvo, devolve um token para o painel.
export async function POST(request: Request) {
  const { username, password } = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!username || !password) return json({ error: "Preencha usuário e senha" }, 400);

  const rows = await sql`SELECT user_id, name, color, is_admin, is_active, password_hash FROM app_users WHERE username = ${username.toLowerCase().trim()}`;
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return json({ error: "Usuário ou senha incorretos" }, 401);
  }
  if (user.is_active === false) return json({ error: "Conta desativada. Fale com o administrador." }, 403);

  const token = await signToken({
    userId: user.user_id,
    name: user.name,
    color: user.color ?? "#3b82f6",
    isAdmin: Boolean(user.is_admin),
  });
  return json({ token, name: user.name, isAdmin: Boolean(user.is_admin) });
}

export const dynamic = "force-dynamic";
