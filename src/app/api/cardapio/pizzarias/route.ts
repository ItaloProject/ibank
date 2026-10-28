import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, pizzariasLiberadas, usuarioCardapio } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

// Lista as pizzarias que o usuário pode editar, pela lista Acessos do painel-admin (administrador vê todas)
export async function GET(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;

  const liberadas = await pizzariasLiberadas(usuario);
  const rows =
    liberadas === "todas"
      ? await cardapioSql`SELECT slug, pizzaria FROM public.pizzarias ORDER BY slug`
      : await cardapioSql`SELECT slug, pizzaria FROM public.pizzarias WHERE slug = ANY(${liberadas}) ORDER BY slug`;

  return json(
    rows.map((r) => {
      const p = r.pizzaria as { nome?: string; logo?: string; tema?: { cor?: string } };
      return { slug: r.slug, nome: p.nome ?? r.slug, cor: p.tema?.cor ?? "#d62d20", logo: p.logo ?? "🍕" };
    }),
  );
}

// Cria uma pizzaria copiando a estrutura de outra (só administrador)
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  if (!usuario.isAdmin) return json({ error: "Somente administradores criam pizzarias" }, 403);

  const { slug, copiarDe } = (await request.json().catch(() => ({}))) as { slug?: string; copiarDe?: string };
  if (!slug || !slugValido(slug)) return json({ error: "Código inválido (letras minúsculas, números e hífen)" }, 400);

  const [base] = await cardapioSql`SELECT pizzaria, cardapio FROM public.pizzarias WHERE slug = ${copiarDe ?? "exemplo"}`;
  if (!base) return json({ error: "Pizzaria de origem não encontrada" }, 404);

  await cardapioSql`INSERT INTO public.pizzarias (slug, pizzaria, cardapio) VALUES (${slug}, ${cardapioSql.json(base.pizzaria)}, ${cardapioSql.json(base.cardapio)})`;
  return json({ slug }, 201);
}
