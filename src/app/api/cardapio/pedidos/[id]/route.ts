import { NextResponse } from "next/server";
import cardapioSql from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio } from "@/lib/cardapio-acesso";

const STATUS = ["recebido", "preparo", "entrega", "concluido", "cancelado"];

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Muda o status de um pedido (recebido → preparo → entrega → concluido, ou cancelado) */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Pedido inválido" }, 400);

  const corpo = (await request.json().catch(() => null)) as { status?: string } | null;
  if (!corpo?.status || !STATUS.includes(corpo.status)) return json({ error: "Status inválido" }, 400);

  const [pedido] = await cardapioSql`SELECT pizzaria_slug FROM public.pedidos WHERE id = ${id}`;
  if (!pedido) return json({ error: "Pedido não encontrado" }, 404);
  if (!(await podeEditarPizzaria(usuario, pedido.pizzaria_slug))) return json({ error: "Sem permissão" }, 403);

  await cardapioSql`UPDATE public.pedidos SET status = ${corpo.status} WHERE id = ${id}`;
  return json({ ok: true });
}
