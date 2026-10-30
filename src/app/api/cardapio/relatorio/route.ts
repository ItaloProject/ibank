import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio, bloqueadoNoNormal } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

const centavosParaReais = (c: number) => Math.round(c) / 100;

/**
 * Pedidos Pix confirmados no mês (horário de Brasília) e a fatura dos centavos extras.
 * Fatura = soma dos centavos de identificação de cada Pix confirmado.
 */
export async function GET(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const mes = url.searchParams.get("mes") ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!/^\d{4}-\d{2}$/.test(mes)) return json({ error: "Mês inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);
  const semPremium = await bloqueadoNoNormal(slug);
  if (semPremium) return semPremium;

  const linhas = await cardapioSql`
    SELECT numero, pago_em, total, centavos_pix
    FROM public.pedidos
    WHERE pizzaria_slug = ${slug}
      AND pagamento = 'Pix'
      AND pagamento_status = 'pago'
      AND status <> 'cancelado'
      AND to_char(pago_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${mes}
    ORDER BY pago_em`;

  const pedidos = linhas.map((l) => {
    const total = Number(l.total);
    const centavos = centavosParaReais(Number(l.centavos_pix ?? 0));
    return {
      numero: Number(l.numero),
      pago_em: new Date(l.pago_em).toISOString(),
      total,
      centavos,
      valor_pix: Math.round((total + centavos) * 100) / 100,
    };
  });

  const recebido = Math.round(pedidos.reduce((soma, p) => soma + p.valor_pix, 0) * 100) / 100;
  const fatura = Math.round(pedidos.reduce((soma, p) => soma + p.centavos, 0) * 100) / 100;

  return json({ mes, pedidos, resumo: { quantidade: pedidos.length, recebido, fatura } });
}
