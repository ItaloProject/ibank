import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { acessosDoUsuario, json, opcoes, usuarioCardapio } from "@/lib/cardapio-acesso";
import { papelNaPizzaria } from "@/lib/permissoes-pizzaria";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Equipe da pizzaria: quem é dono e quem é garçom. Qualquer pessoa com acesso vê; só dono e admin mexem. */
export async function GET(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  const voce = papelNaPizzaria(await acessosDoUsuario(usuario), slug);
  if (!voce) return json({ error: "Sem permissão" }, 403);

  const membros = await cardapioSql`
    SELECT email, papel, bloqueado FROM public.acessos WHERE pizzaria_slug = ${slug} ORDER BY papel, email`;
  return json({ voce, membros });
}

/** Adiciona ou muda o papel de alguém na pizzaria. Garçom: dono ou admin. Dono: só admin. */
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const corpo = (await request.json().catch(() => null)) as { slug?: string; email?: string; papel?: string } | null;
  const slug = corpo?.slug ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  const voce = papelNaPizzaria(await acessosDoUsuario(usuario), slug);
  if (voce !== "admin" && voce !== "dono") return json({ error: "Só o dono pode gerenciar a equipe" }, 403);

  const email = (corpo?.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return json({ error: "E-mail inválido" }, 400);
  const papel = corpo?.papel;
  if (papel !== "garcom" && papel !== "dono") return json({ error: "Papel inválido" }, 400);
  if (papel === "dono" && voce !== "admin") return json({ error: "Só o administrador adiciona outro dono" }, 403);

  const atualizados = await cardapioSql`
    UPDATE public.acessos SET papel = ${papel}, bloqueado = false
    WHERE lower(email) = ${email} AND pizzaria_slug = ${slug} RETURNING id`;
  if (atualizados.length === 0) {
    await cardapioSql`INSERT INTO public.acessos (email, papel, pizzaria_slug) VALUES (${email}, ${papel}, ${slug})`;
  }
  return json({ ok: true }, 201);
}

/** Tira alguém da equipe da pizzaria. O admin global da lista não é removido por aqui. */
export async function DELETE(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const corpo = (await request.json().catch(() => null)) as { slug?: string; email?: string } | null;
  const slug = corpo?.slug ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  const voce = papelNaPizzaria(await acessosDoUsuario(usuario), slug);
  if (voce !== "admin" && voce !== "dono") return json({ error: "Só o dono pode gerenciar a equipe" }, 403);

  const email = (corpo?.email ?? "").trim().toLowerCase();
  await cardapioSql`DELETE FROM public.acessos WHERE lower(email) = ${email} AND pizzaria_slug = ${slug} AND papel IN ('garcom', 'dono')`;
  return json({ ok: true });
}
