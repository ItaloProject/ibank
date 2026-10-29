import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio } from "@/lib/cardapio-acesso";
import { calcularTotais, ErroPedido, montarPedido, type EscolhaItem } from "@/lib/pedido-manual";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Lança um pedido feito por telefone, no balcão ou na mesa. O preço é calculado aqui, com o cardápio salvo. */
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;

  const corpo = (await request.json().catch(() => null)) as {
    slug?: string;
    modo?: string;
    cliente?: Record<string, unknown>;
    escolhas?: unknown;
    pagamento?: string;
    troco?: string | null;
    /** Só calcula os totais, para a tela mostrar o valor antes de lançar */
    previa?: boolean;
  } | null;
  const slug = corpo?.slug ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);
  if (!Array.isArray(corpo?.escolhas)) return json({ error: "Adicione pelo menos um item" }, 400);

  const [pizzaria] = await cardapioSql`SELECT pizzaria, cardapio FROM public.pizzarias WHERE slug = ${slug}`;
  if (!pizzaria) return json({ error: "Pizzaria não encontrada" }, 404);
  const config = (pizzaria.pizzaria as { pedidos?: Record<string, unknown> }).pedidos ?? {};

  try {
    if (corpo?.previa) {
      // Consumo no local (comanda) vale mesmo sem pedidos online ligados
      const configPrevia = corpo.modo === "mesa" ? { ...config, modos: [...((config as { modos?: string[] }).modos ?? []), "mesa"] } : config;
      const totais = calcularTotais(pizzaria.cardapio as never, configPrevia as never, corpo.modo ?? "", corpo.escolhas as EscolhaItem[]);
      return json({ ok: true, subtotal: totais.subtotal, taxa: totais.taxa, total: totais.total, itens: totais.itens }, 200);
    }

    const pedido = montarPedido(pizzaria.cardapio as never, config as never, {
      modo: corpo?.modo ?? "",
      cliente: (corpo?.cliente ?? {}) as never,
      escolhas: corpo!.escolhas as EscolhaItem[],
      pagamento: corpo?.pagamento ?? "",
      troco: corpo?.troco,
    });

    const itens = pedido.itens.map((l) => ({ nome: l.nome, variante: l.variante, qtd: l.qtd, preco: l.preco, detalhes: l.detalhes, obs: l.obs }));
    const [novo] = await cardapioSql`
      INSERT INTO public.pedidos (pizzaria_slug, modo, cliente, itens, subtotal, taxa, total, pagamento, troco, origem)
      VALUES (${slug}, ${pedido.modo}, ${cardapioSql.json(pedido.cliente)}, ${cardapioSql.json(itens)},
              ${pedido.subtotal}, ${pedido.taxa}, ${pedido.total}, ${pedido.pagamento}, ${pedido.troco}, 'manual')
      RETURNING id, numero, total`;

    // Pix: reserva os centavos que identificam o pagamento, igual ao pedido do cliente
    if (pedido.pagamento === "Pix") await cardapioSql`SELECT public.reservar_centavos_pix(${novo.id}::uuid)`;

    return json({ ok: true, id: novo.id, numero: Number(novo.numero), total: Number(novo.total) }, 201);
  } catch (e) {
    if (e instanceof ErroPedido) return json({ error: e.message }, 400);
    throw e;
  }
}
