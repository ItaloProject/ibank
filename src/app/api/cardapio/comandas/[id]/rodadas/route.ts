import { NextResponse } from "next/server";
import cardapioSql from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio, bloqueadoNoNormal } from "@/lib/cardapio-acesso";
import { calcularTotais, ErroPedido, type EscolhaItem } from "@/lib/pedido-manual";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Lança uma rodada de itens na comanda: vira um pedido de mesa, que segue para a cozinha */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Comanda inválida" }, 400);

  const [comanda] = await cardapioSql`SELECT pizzaria_slug, mesa, status FROM public.comandas WHERE id = ${id}`;
  if (!comanda) return json({ error: "Comanda não encontrada" }, 404);
  if (comanda.status !== "aberta") return json({ error: "Essa comanda já está fechada" }, 400);
  if (!(await podeEditarPizzaria(usuario, comanda.pizzaria_slug))) return json({ error: "Sem permissão" }, 403);
  const semPremium = await bloqueadoNoNormal(comanda.pizzaria_slug);
  if (semPremium) return semPremium;

  const corpo = (await request.json().catch(() => null)) as { escolhas?: unknown } | null;
  if (!Array.isArray(corpo?.escolhas)) return json({ error: "Adicione pelo menos um item" }, 400);

  const [pizzaria] = await cardapioSql`SELECT pizzaria, cardapio FROM public.pizzarias WHERE slug = ${comanda.pizzaria_slug}`;
  if (!pizzaria) return json({ error: "Pizzaria não encontrada" }, 404);
  // Consumo no local vale mesmo que a pizzaria não tenha ligado para pedidos online
  const config = { ...((pizzaria.pizzaria as { pedidos?: Record<string, unknown> }).pedidos ?? {}), modos: ["mesa"] };

  try {
    const totais = calcularTotais(pizzaria.cardapio as never, config as never, "mesa", corpo!.escolhas as EscolhaItem[]);
    const itens = totais.itens.map((l) => ({ nome: l.nome, variante: l.variante, qtd: l.qtd, preco: l.preco, detalhes: l.detalhes, obs: l.obs }));
    const [rodada] = await cardapioSql`
      INSERT INTO public.pedidos (pizzaria_slug, modo, cliente, itens, subtotal, taxa, total, pagamento, troco, origem, comanda_id)
      VALUES (${comanda.pizzaria_slug}, 'mesa', ${cardapioSql.json({ nome: `Mesa ${comanda.mesa}`, mesa: comanda.mesa, telefone: null, endereco: null, referencia: null })},
              ${cardapioSql.json(itens)}, ${totais.subtotal}, 0, ${totais.total}, 'A pagar', '', 'manual', ${id}::uuid)
      RETURNING id, numero, total`;
    return json({ ok: true, pedido: { id: rodada.id, numero: Number(rodada.numero), total: Number(rodada.total) } }, 201);
  } catch (e) {
    if (e instanceof ErroPedido) return json({ error: e.message }, 400);
    throw e;
  }
}
