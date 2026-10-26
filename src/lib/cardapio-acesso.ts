import { NextResponse } from "next/server";
import sql from "@/lib/db";
import cardapioSql from "@/lib/cardapio-db";
import { getSession, verifyToken } from "@/lib/auth";

export type UsuarioCardapio = { userId: string; name: string; isAdmin: boolean };

/**
 * Quem está chamando a API do cardápio. Aceita o token do login (Authorization: Bearer)
 * ou a sessão do próprio Muvo (cookie). Confere a conta no banco a cada chamada.
 */
export async function usuarioCardapio(request: Request): Promise<UsuarioCardapio | NextResponse> {
  const cabecalho = request.headers.get("authorization") ?? "";
  let userId: string | null = null;
  let name = "";

  if (cabecalho.startsWith("Bearer ")) {
    const payload = await verifyToken(cabecalho.slice(7));
    if (payload?.userId) {
      userId = payload.userId;
      name = payload.name ?? "";
    }
  } else {
    const sessao = await getSession();
    if (sessao?.userId) {
      userId = sessao.userId;
      name = sessao.name ?? "";
    }
  }

  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await sql`SELECT is_active, is_admin, name FROM app_users WHERE user_id = ${userId}`;
  if (rows.length === 0 || rows[0].is_active === false) {
    return NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 });
  }
  return { userId, name: rows[0].name ?? name, isAdmin: Boolean(rows[0].is_admin) };
}

export function json(corpo: unknown, status = 200) {
  return withCors(NextResponse.json(corpo, { status }));
}

/** Libera a chamada vinda do painel online (Cloudflare Pages) e do desenvolvimento local. */
export const ORIGENS_PERMITIDAS = [
  "https://painel-cardapio.pages.dev",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
];

export function withCors(res: NextResponse, origem?: string | null) {
  const liberada = origem && ORIGENS_PERMITIDAS.includes(origem) ? origem : ORIGENS_PERMITIDAS[0];
  res.headers.set("Access-Control-Allow-Origin", liberada);
  res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.headers.set("Vary", "Origin");
  return res;
}

export function opcoes(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request.headers.get("origin"));
}

/** Admin edita qualquer pizzaria; dono só as que o admin do Muvo liberou em acessos_muvo. */
export async function podeEditarPizzaria(usuario: UsuarioCardapio, slug: string): Promise<boolean> {
  if (usuario.isAdmin) return true;
  const rows = await cardapioSql`SELECT 1 FROM public.acessos_muvo WHERE user_id = ${usuario.userId} AND pizzaria_slug = ${slug}`;
  return rows.length > 0;
}
