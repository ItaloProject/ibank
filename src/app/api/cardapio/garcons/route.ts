import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { acessosDoUsuario, json, opcoes, usuarioCardapio, bloqueadoNoNormal } from "@/lib/cardapio-acesso";
import { papelNaPizzaria } from "@/lib/permissoes-pizzaria";
import { loginGarcomValido, nomeGarcomValido, senhaGarcomValida } from "@/lib/garcom-regras";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Só o dono e o admin gerenciam os garçons da pizzaria */
async function podeGerenciar(usuario: Awaited<ReturnType<typeof usuarioCardapio>>, slug: string): Promise<boolean> {
  if (usuario instanceof NextResponse) return false;
  const voce = papelNaPizzaria(await acessosDoUsuario(usuario), slug);
  return voce === "admin" || voce === "dono";
}

export async function GET(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeGerenciar(usuario, slug))) return json({ error: "Só o dono pode gerenciar os garçons" }, 403);
  const semPremium = await bloqueadoNoNormal(slug);
  if (semPremium) return semPremium;

  const garcons = await cardapioSql`SELECT id, nome, login, ativo FROM public.garcons WHERE pizzaria_slug = ${slug} ORDER BY nome`;
  return json({ garcons });
}

/** Cria um garçom com login e senha próprios */
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const corpo = (await request.json().catch(() => null)) as { slug?: string; nome?: unknown; login?: unknown; senha?: unknown } | null;
  const slug = corpo?.slug ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeGerenciar(usuario, slug))) return json({ error: "Só o dono pode gerenciar os garçons" }, 403);
  const semPremium = await bloqueadoNoNormal(slug);
  if (semPremium) return semPremium;

  const nome = nomeGarcomValido(corpo?.nome);
  const login = loginGarcomValido(corpo?.login);
  if (!nome) return json({ error: "Informe o nome do garçom" }, 400);
  if (!login) return json({ error: "Login: 3 a 30 letras minúsculas, números, ponto, traço ou underline" }, 400);
  if (!senhaGarcomValida(corpo?.senha)) return json({ error: "A senha precisa ter de 6 a 72 caracteres" }, 400);

  const hash = await bcrypt.hash(corpo!.senha as string, 12);
  try {
    const [novo] = await cardapioSql`
      INSERT INTO public.garcons (pizzaria_slug, nome, login, password_hash) VALUES (${slug}, ${nome}, ${login}, ${hash})
      RETURNING id, nome, login, ativo`;
    return json({ garcom: novo }, 201);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return json({ error: `O login "${login}" já existe nesta pizzaria` }, 409);
    throw e;
  }
}

/** Ativa ou desativa um garçom, e troca a senha se for informada */
export async function PATCH(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const corpo = (await request.json().catch(() => null)) as { slug?: string; id?: string; ativo?: unknown; senha?: unknown } | null;
  const slug = corpo?.slug ?? "";
  if (!slugValido(slug) || !/^[0-9a-f-]{36}$/i.test(corpo?.id ?? "")) return json({ error: "Pedido inválido" }, 400);
  if (!(await podeGerenciar(usuario, slug))) return json({ error: "Só o dono pode gerenciar os garçons" }, 403);
  const semPremium = await bloqueadoNoNormal(slug);
  if (semPremium) return semPremium;

  if (typeof corpo?.ativo === "boolean") {
    await cardapioSql`UPDATE public.garcons SET ativo = ${corpo.ativo} WHERE id = ${corpo.id!}::uuid AND pizzaria_slug = ${slug}`;
  }
  if (corpo?.senha !== undefined) {
    if (!senhaGarcomValida(corpo.senha)) return json({ error: "A senha precisa ter de 6 a 72 caracteres" }, 400);
    const hash = await bcrypt.hash(corpo.senha as string, 12);
    await cardapioSql`UPDATE public.garcons SET password_hash = ${hash} WHERE id = ${corpo.id!}::uuid AND pizzaria_slug = ${slug}`;
  }
  return json({ ok: true });
}
