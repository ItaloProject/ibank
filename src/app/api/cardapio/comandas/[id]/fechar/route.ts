import { NextResponse } from "next/server";
import cardapioSql from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio, bloqueadoNoNormal } from "@/lib/cardapio-acesso";
import { totalComanda } from "@/lib/comanda";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Fecha a comanda: grava a forma de pagamento em todas as rodadas e trava a mesa */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Comanda inválida" }, 400);

  const [comanda] = await cardapioSql`SELECT pizzaria_slug, status FROM public.comandas WHERE id = ${id}`;
  if (!comanda) return json({ error: "Comanda não encontrada" }, 404);
  if (!(await podeEditarPizzaria(usuario, comanda.pizzaria_slug))) return json({ error: "Sem permissão" }, 403);
  const semPremium = await bloqueadoNoNormal(comanda.pizzaria_slug);
  if (semPremium) return semPremium;
  if (comanda.status !== "aberta") return json({ error: "Essa comanda já está fechada" }, 400);

  const corpo = (await request.json().catch(() => null)) as { pagamento?: string; troco?: string | null } | null;
  const [pizzaria] = await cardapioSql`SELECT pizzaria FROM public.pizzarias WHERE slug = ${comanda.pizzaria_slug}`;
  const config = (pizzaria?.pizzaria as { pedidos?: { pagamentos?: string[]; chavePix?: string } })?.pedidos ?? {};
  const pagamento = corpo?.pagamento ?? "";
  if (!(config.pagamentos ?? []).includes(pagamento)) return json({ error: `${pagamento || "Pagamento"} não está nas formas de pagamento da pizzaria` }, 400);
  if (pagamento === "Pix" && !config.chavePix?.trim()) return json({ error: "Pix sem chave cadastrada" }, 400);
  const troco = pagamento === "Dinheiro" ? (corpo?.troco ?? "").trim().slice(0, 40) : "";

  const rodadas = await cardapioSql`SELECT id, total, status FROM public.pedidos WHERE comanda_id = ${id}`;
  const total = totalComanda(rodadas.map((r) => ({ total: r.total as number, status: r.status as string })));

  // Trava a comanda primeiro: se duas pessoas fecharem ao mesmo tempo, só uma passa
  const [fechada] = await cardapioSql`
    UPDATE public.comandas SET status = 'fechada', pagamento = ${pagamento}, troco = ${troco}, total = ${total}, fechada_em = now()
    WHERE id = ${id} AND status = 'aberta' RETURNING id`;
  if (!fechada) return json({ error: "Essa comanda já está fechada" }, 409);

  await cardapioSql`UPDATE public.pedidos SET pagamento = ${pagamento}, troco = ${troco} WHERE comanda_id = ${id} AND status <> 'cancelado'`;
  if (pagamento === "Pix") {
    for (const r of rodadas.filter((x) => x.status !== "cancelado")) {
      await cardapioSql`SELECT public.reservar_centavos_pix(${r.id}::uuid)`;
    }
  }
  return json({ ok: true, total });
}
