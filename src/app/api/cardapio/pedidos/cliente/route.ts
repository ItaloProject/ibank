import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { ErroPedido, montarPedido, type EscolhaItem } from "@/lib/pedido-manual";
import { estaAberto, type Excecao, type Horario } from "@/lib/horario-loja";
import { extrairIp, hashIp, JANELA_MINUTOS, LIMITE_ENVIOS } from "@/lib/limite-envios";

// Rota pública: o cardápio do cliente chama sem login. Não usa cookie nem Authorization, então aceita qualquer origem.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responde(corpo: unknown, status = 200) {
  return NextResponse.json(corpo, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Grava o pedido feito pelo cliente. O preço é calculado aqui, a partir do cardápio salvo;
 * o que o navegador envia são só as escolhas (item, tamanho, borda, adicionais).
 */
export async function POST(request: Request) {
  // Cada tentativa conta, inclusive as recusadas, para que spam não fique de graça
  const origem = hashIp(extrairIp(request.headers));
  const [{ envios }] = await cardapioSql`
    SELECT count(*)::int AS envios FROM public.envios_pedido
    WHERE ip_hash = ${origem} AND criado_em > now() - make_interval(mins => ${JANELA_MINUTOS})`;
  if (envios >= LIMITE_ENVIOS) {
    return responde({ error: "Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo." }, 429);
  }
  await cardapioSql`INSERT INTO public.envios_pedido (ip_hash) VALUES (${origem})`;
  // Limpeza das tentativas antigas, em uma fração das chamadas
  if (Math.random() < 0.02) {
    await cardapioSql`DELETE FROM public.envios_pedido WHERE criado_em < now() - interval '1 day'`;
  }

  const corpo = (await request.json().catch(() => null)) as {
    id?: string;
    slug?: string;
    modo?: string;
    cliente?: Record<string, unknown>;
    escolhas?: unknown;
    pagamento?: string;
    troco?: string | null;
  } | null;

  const id = corpo?.id ?? "";
  const slug = corpo?.slug ?? "";
  if (!ID.test(id) || !slugValido(slug)) return responde({ error: "Pedido inválido" }, 400);
  if (!Array.isArray(corpo?.escolhas)) return responde({ error: "Adicione pelo menos um item" }, 400);

  const [pizzaria] = await cardapioSql`SELECT pizzaria, cardapio, publicado FROM public.pizzarias WHERE slug = ${slug}`;
  if (!pizzaria || !pizzaria.publicado) return responde({ error: "Cardápio não disponível" }, 404);

  const dadosPizzaria = pizzaria.pizzaria as { pedidos?: Record<string, unknown>; horarios?: Horario[]; excecoes?: Excecao[] };
  const config = dadosPizzaria.pedidos ?? {};
  if (!config.ativo) return responde({ error: "A pizzaria não está recebendo pedidos agora" }, 400);
  if (!estaAberto(dadosPizzaria.horarios, dadosPizzaria.excecoes, new Date())) {
    return responde({ error: "A pizzaria está fechada agora. Tente no horário de funcionamento." }, 400);
  }

  try {
    const pedido = montarPedido(pizzaria.cardapio as never, config as never, {
      modo: corpo?.modo ?? "",
      cliente: (corpo?.cliente ?? {}) as never,
      escolhas: corpo!.escolhas as EscolhaItem[],
      pagamento: corpo?.pagamento ?? "",
      troco: corpo?.troco,
    });

    const minimo = Number(config.pedidoMinimo ?? 0);
    if (pedido.modo === "entrega" && minimo > 0 && pedido.subtotal < minimo) {
      throw new ErroPedido(`O pedido mínimo para entrega é de R$ ${minimo.toFixed(2).replace(".", ",")}`);
    }

    const itens = pedido.itens.map((l) => ({ nome: l.nome, variante: l.variante, qtd: l.qtd, preco: l.preco, detalhes: l.detalhes, obs: l.obs }));
    const [novo] = await cardapioSql`
      INSERT INTO public.pedidos (id, pizzaria_slug, modo, cliente, itens, subtotal, taxa, total, pagamento, troco, origem)
      VALUES (${id}::uuid, ${slug}, ${pedido.modo}, ${cardapioSql.json(pedido.cliente)}, ${cardapioSql.json(itens)},
              ${pedido.subtotal}, ${pedido.taxa}, ${pedido.total}, ${pedido.pagamento}, ${pedido.troco}, 'cardapio')
      RETURNING numero`;

    // Pix: reserva os centavos que identificam o pagamento, para o cliente ver o valor exato na página do pedido
    let centavosPix: number | null = null;
    if (pedido.pagamento === "Pix") {
      const [reserva] = await cardapioSql`SELECT public.reservar_centavos_pix(${id}::uuid) AS centavos`;
      centavosPix = reserva?.centavos == null ? null : Number(reserva.centavos);
    }

    return responde(
      { ok: true, id, numero: Number(novo.numero), subtotal: pedido.subtotal, taxa: pedido.taxa, total: pedido.total, centavos_pix: centavosPix },
      201,
    );
  } catch (e) {
    if (e instanceof ErroPedido) return responde({ error: e.message }, 400);
    // id repetido: o mesmo pedido foi enviado de novo (ex.: recarregou a página)
    if ((e as { code?: string }).code === "23505") return responde({ error: "Esse pedido já foi enviado" }, 409);
    throw e;
  }
}
