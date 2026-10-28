import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Pedidos da pizzaria, do mais recente para o mais antigo */
export async function GET(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);

  const pedidos = await cardapioSql`
    SELECT id, numero, modo, cliente, itens, subtotal, taxa, total, pagamento, troco, status, pagamento_status, pago_em, centavos_pix, criado_em,
      entregador_id, (SELECT nome FROM public.entregadores WHERE id = pedidos.entregador_id) AS entregador_nome, origem, motivo_cancelamento
    FROM public.pedidos WHERE pizzaria_slug = ${slug}
    ORDER BY criado_em DESC LIMIT 200`;
  return json({ pedidos });
}
