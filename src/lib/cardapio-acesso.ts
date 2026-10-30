import { NextResponse } from "next/server";
import sql from "@/lib/db";
import cardapioSql from "@/lib/cardapio-db";
import { pizzariasDoAcesso, type LinhaAcesso } from "@/lib/permissoes-pizzaria";
export type { LinhaAcesso } from "@/lib/permissoes-pizzaria";
import { getSession, verifyToken } from "@/lib/auth";
import { lerSessaoGarcom } from "@/lib/garcom-sessao";

/** garcomSlug: quando é um garçom, a única pizzaria dele. Garçom não tem conta no Muvo. */
export type UsuarioCardapio = { userId: string; name: string; isAdmin: boolean; garcomSlug?: string };

/**
 * Quem está chamando a API do cardápio. Aceita o token do login (Authorization: Bearer)
 * ou a sessão do próprio Muvo (cookie). Confere a conta no banco a cada chamada.
 */
export async function usuarioCardapio(request: Request): Promise<UsuarioCardapio | NextResponse> {
  const cabecalho = request.headers.get("authorization") ?? "";
  let userId: string | null = null;
  let name = "";

  if (cabecalho.startsWith("Bearer ")) {
    const garcom = await lerSessaoGarcom(cabecalho.slice(7));
    if (garcom) {
      const [ativo] = await cardapioSql`SELECT nome FROM public.garcons WHERE id = ${garcom.garcomId}::uuid AND ativo AND pizzaria_slug = ${garcom.slug}`;
      if (!ativo) return json({ error: "Sessão encerrada. Entre de novo." }, 401);
      return { userId: `garcom:${garcom.garcomId}`, name: ativo.nome as string, isAdmin: false, garcomSlug: garcom.slug };
    }
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

  // Respostas de erro também precisam do cabeçalho de CORS, senão o painel mostra "Failed to fetch" em vez de pedir login
  if (!userId) return json({ error: "Não autenticado" }, 401);

  const rows = await sql`SELECT is_active, is_admin, name FROM app_users WHERE user_id = ${userId}`;
  if (rows.length === 0 || rows[0].is_active === false) {
    return json({ error: "Sessão inválida. Faça login novamente." }, 401);
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

/**
 * Pizzarias que o usuário pode editar, pela lista Acessos do painel-admin (ligação pelo e-mail do Muvo).
 * "todas" para admin global; lista vazia para quem não tem nenhuma liberação ou está bloqueado.
 */
export async function acessosDoUsuario(usuario: UsuarioCardapio): Promise<LinhaAcesso[]> {
  // Garçom: só a pizzaria dele, com papel garcom (não pode gerenciar a equipe)
  if (usuario.garcomSlug) return [{ papel: "garcom", pizzaria_slug: usuario.garcomSlug }];
  const [conta] = await sql`SELECT email FROM app_users WHERE user_id = ${usuario.userId}`;
  const email = typeof conta?.email === "string" ? conta.email.trim().toLowerCase() : "";
  if (!email) return [];
  // A lista Acessos fica no banco do cardápio (o mesmo que o painel-admin usa)
  const linhas = await cardapioSql`
    SELECT papel, pizzaria_slug FROM public.acessos WHERE lower(email) = ${email} AND NOT bloqueado`;
  return linhas.map((l) => ({ papel: String(l.papel), pizzaria_slug: l.pizzaria_slug == null ? null : String(l.pizzaria_slug) }));
}

export async function pizzariasLiberadas(usuario: UsuarioCardapio): Promise<string[] | "todas"> {
  return pizzariasDoAcesso(await acessosDoUsuario(usuario));
}

/** Admin global edita todas; dono só as pizzarias liberadas na lista Acessos do painel-admin. */
export async function podeEditarPizzaria(usuario: UsuarioCardapio, slug: string): Promise<boolean> {
  if (usuario.garcomSlug) return usuario.garcomSlug === slug;
  const liberadas = await pizzariasLiberadas(usuario);
  return liberadas === "todas" || liberadas.includes(slug);
}

/**
 * Plano da pizzaria: "premium" (padrão) ou "normal". Só o premium tem pedidos no painel,
 * cozinha, mesas, equipe de garçons, entregadores, relatório e alertas.
 */
export async function ehPlanoNormal(slug: string): Promise<boolean> {
  const [linha] = await cardapioSql`SELECT plano FROM public.pizzarias WHERE slug = ${slug}`;
  return linha?.plano === "normal";
}

/** Recurso premium: responde 403 quando a pizzaria está no plano normal; null quando pode seguir */
export async function bloqueadoNoNormal(slug: string): Promise<NextResponse | null> {
  return (await ehPlanoNormal(slug)) ? json({ error: "Disponível no plano premium" }, 403) : null;
}
