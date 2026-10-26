import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio } from "@/lib/cardapio-acesso";
import { telegramBotUsername } from "@/lib/telegram";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Gera um código de uso único (vale 15 minutos) e o link para o dono abrir o bot */
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;

  const corpo = (await request.json().catch(() => null)) as { slug?: string } | null;
  const slug = corpo?.slug ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);

  const bot = telegramBotUsername();
  if (!bot) return json({ error: "Telegram não configurado" }, 503);

  const codigo = randomBytes(6).toString("hex");
  await cardapioSql`DELETE FROM public.telegram_codigos WHERE expira_em < now() OR (pizzaria_slug = ${slug} AND usado = false)`;
  await cardapioSql`INSERT INTO public.telegram_codigos (codigo, pizzaria_slug, expira_em) VALUES (${codigo}, ${slug}, now() + interval '15 minutes')`;

  return json({ link: `https://t.me/${bot}?start=${codigo}` });
}
