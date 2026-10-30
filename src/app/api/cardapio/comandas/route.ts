import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio, bloqueadoNoNormal } from "@/lib/cardapio-acesso";
import { mesaValida } from "@/lib/comanda";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Comandas abertas da pizzaria, com o total de cada uma */
export async function GET(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);
  const semPremium = await bloqueadoNoNormal(slug);
  if (semPremium) return semPremium;

  const comandas = await cardapioSql`
    SELECT c.id, c.mesa, c.aberta_em,
      COALESCE(SUM(p.total) FILTER (WHERE p.status <> 'cancelado'), 0) AS total,
      COUNT(p.id) FILTER (WHERE p.status <> 'cancelado')::int AS rodadas
    FROM public.comandas c
    LEFT JOIN public.pedidos p ON p.comanda_id = c.id
    WHERE c.pizzaria_slug = ${slug} AND c.status = 'aberta'
    GROUP BY c.id
    ORDER BY c.aberta_em`;
  return json({ comandas: comandas.map((c) => ({ ...c, total: Number(c.total) })) });
}

/** Abre a comanda de uma mesa. Só uma aberta por mesa. */
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const corpo = (await request.json().catch(() => null)) as { slug?: string; mesa?: unknown } | null;
  const slug = corpo?.slug ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);
  const semPremium = await bloqueadoNoNormal(slug);
  if (semPremium) return semPremium;
  const mesa = mesaValida(corpo?.mesa);
  if (!mesa) return json({ error: "Informe o número ou nome da mesa (até 20 caracteres)" }, 400);

  try {
    const [nova] = await cardapioSql`
      INSERT INTO public.comandas (pizzaria_slug, mesa) VALUES (${slug}, ${mesa})
      RETURNING id, mesa, aberta_em`;
    return json({ comanda: { ...nova, total: 0, rodadas: 0 } }, 201);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return json({ error: `A mesa ${mesa} já tem uma comanda aberta` }, 409);
    throw e;
  }
}
