import { NextResponse } from "next/server";
import cardapioSql from "@/lib/cardapio-db";
import { zerarPausados } from "@/lib/reset-pausados";

/**
 * Chamado todo dia às 00:00 de Brasília (agendamento em vercel.json).
 * A Vercel envia "Authorization: Bearer <CRON_SECRET>"; sem o segredo, não faz nada.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET ?? "";
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const pizzarias = await cardapioSql`
    SELECT slug, cardapio FROM public.pizzarias WHERE cardapio::text LIKE ${"%\"indisponivel\":true%"}`;

  let itens = 0;
  for (const p of pizzarias) {
    const r = zerarPausados(p.cardapio as { categorias?: { itens: { indisponivel?: boolean }[] }[] });
    if (r.quantidade === 0) continue;
    itens += r.quantidade;
    await cardapioSql`UPDATE public.pizzarias SET cardapio = ${cardapioSql.json(r.cardapio as never)} WHERE slug = ${p.slug}`;
  }

  return NextResponse.json({ ok: true, pizzarias: pizzarias.length, itensLiberados: itens });
}
