import { NextResponse } from "next/server";
import cardapioSql from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio } from "@/lib/cardapio-acesso";
import { totalComanda } from "@/lib/comanda";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Detalhe da comanda: cada rodada com seus itens, e o total */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Comanda inválida" }, 400);

  const [comanda] = await cardapioSql`SELECT id, pizzaria_slug, mesa, status, pagamento, troco, total, aberta_em, fechada_em FROM public.comandas WHERE id = ${id}`;
  if (!comanda) return json({ error: "Comanda não encontrada" }, 404);
  if (!(await podeEditarPizzaria(usuario, comanda.pizzaria_slug))) return json({ error: "Sem permissão" }, 403);

  const rodadas = await cardapioSql`
    SELECT id, numero, itens, subtotal, total, status, criado_em FROM public.pedidos WHERE comanda_id = ${id} ORDER BY criado_em`;
  const total = comanda.status === "aberta" ? totalComanda(rodadas.map((r) => ({ total: r.total as number, status: r.status as string }))) : Number(comanda.total);
  return json({ comanda: { ...comanda, total }, rodadas });
}
