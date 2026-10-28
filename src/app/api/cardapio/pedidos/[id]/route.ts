import { NextResponse } from "next/server";
import cardapioSql from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio } from "@/lib/cardapio-acesso";

const STATUS = ["recebido", "preparo", "entrega", "concluido", "cancelado"];

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Muda o status do pedido (recebido → preparo → entrega → concluido, ou cancelado), confirma o Pix recebido ou escolhe o entregador */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Pedido inválido" }, 400);

  const corpo = (await request.json().catch(() => null)) as { status?: string; pagamento?: "pago" | "pendente"; entregadorId?: string | null } | null;
  const trocaStatus = corpo?.status !== undefined;
  const trocaPagamento = corpo?.pagamento !== undefined;
  const trocaEntregador = corpo?.entregadorId !== undefined;
  if ([trocaStatus, trocaPagamento, trocaEntregador].filter(Boolean).length !== 1) {
    return json({ error: "Informe status, pagamento ou entregador" }, 400);
  }
  if (trocaStatus && !STATUS.includes(corpo!.status!)) return json({ error: "Status inválido" }, 400);
  if (trocaPagamento && corpo!.pagamento !== "pago" && corpo!.pagamento !== "pendente") return json({ error: "Pagamento inválido" }, 400);

  const [pedido] = await cardapioSql`SELECT pizzaria_slug FROM public.pedidos WHERE id = ${id}`;
  if (!pedido) return json({ error: "Pedido não encontrado" }, 404);
  if (!(await podeEditarPizzaria(usuario, pedido.pizzaria_slug))) return json({ error: "Sem permissão" }, 403);

  if (trocaStatus) {
    await cardapioSql`UPDATE public.pedidos SET status = ${corpo!.status!} WHERE id = ${id}`;
  } else if (trocaEntregador) {
    const entregadorId = corpo!.entregadorId as string | null;
    if (entregadorId !== null) {
      if (!/^[0-9a-f-]{36}$/i.test(entregadorId)) return json({ error: "Entregador inválido" }, 400);
      // Só entregador ativo da mesma pizzaria: o cadastro é da pizzaria, não do pedido
      const [entregador] = await cardapioSql`
        SELECT id FROM public.entregadores WHERE id = ${entregadorId} AND pizzaria_slug = ${pedido.pizzaria_slug} AND ativo`;
      if (!entregador) return json({ error: "Entregador não encontrado ou desativado" }, 400);
    }
    await cardapioSql`UPDATE public.pedidos SET entregador_id = ${entregadorId} WHERE id = ${id}`;
  } else if (corpo!.pagamento === "pago") {
    await cardapioSql`UPDATE public.pedidos SET pagamento_status = pago, pago_em = now() WHERE id = ${id}`;
  } else {
    await cardapioSql`UPDATE public.pedidos SET pagamento_status = pendente, pago_em = NULL WHERE id = ${id}`;
  }
  return json({ ok: true });
}
