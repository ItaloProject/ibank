import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}


export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const { slug } = await params;
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);

  const [linha] = await cardapioSql`SELECT pizzaria, cardapio, plano FROM public.pizzarias WHERE slug = ${slug}`;
  if (!linha) return json({ error: "Pizzaria não encontrada" }, 404);
  return json({ pizzaria: linha.pizzaria, cardapio: linha.cardapio, plano: linha.plano });
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const { slug } = await params;
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);

  const corpo = (await request.json().catch(() => null)) as { pizzaria?: unknown; cardapio?: unknown } | null;
  if (!corpo?.pizzaria || !corpo?.cardapio) return json({ error: "Dados incompletos" }, 400);

  const linhas = await cardapioSql`
    UPDATE public.pizzarias SET pizzaria = ${cardapioSql.json(corpo.pizzaria as never)}, cardapio = ${cardapioSql.json(corpo.cardapio as never)}
    WHERE slug = ${slug} RETURNING slug`;
  if (linhas.length === 0) return json({ error: "Pizzaria não encontrada" }, 404);
  return json({ ok: true });
}
