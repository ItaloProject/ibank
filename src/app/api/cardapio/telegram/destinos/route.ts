import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Lista os chats do Telegram que recebem os alertas da pizzaria */
export async function GET(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);

  const destinos = await cardapioSql`SELECT id, nome, criado_em FROM public.telegram_destinos WHERE pizzaria_slug = ${slug} ORDER BY criado_em`;
  return json({ destinos });
}

/** Remove um chat da lista de alertas */
export async function DELETE(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const corpo = (await request.json().catch(() => null)) as { slug?: string; id?: string } | null;
  const slug = corpo?.slug ?? "";
  const id = corpo?.id ?? "";
  if (!slugValido(slug) || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Pedido inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);

  await cardapioSql`DELETE FROM public.telegram_destinos WHERE id = ${id} AND pizzaria_slug = ${slug}`;
  return json({ ok: true });
}
