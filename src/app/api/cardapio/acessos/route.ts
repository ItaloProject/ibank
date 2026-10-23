import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import sql from "@/lib/db";
import { json, opcoes, usuarioCardapio } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

// Lista usuários do Muvo e as pizzarias que cada um pode editar (só administrador)
export async function GET(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  if (!usuario.isAdmin) return json({ error: "Somente administradores" }, 403);

  const usuarios = await sql`SELECT user_id, username, name, is_active, is_admin FROM app_users ORDER BY name`;
  const acessos = await cardapioSql`SELECT user_id, pizzaria_slug FROM public.acessos_muvo`;
  const pizzarias = await cardapioSql`SELECT slug FROM public.pizzarias ORDER BY slug`;

  return json({
    usuarios: usuarios.map((u) => ({
      userId: u.user_id,
      username: u.username,
      name: u.name,
      ativo: u.is_active !== false,
      admin: Boolean(u.is_admin),
      pizzarias: acessos.filter((a) => a.user_id === u.user_id).map((a) => a.pizzaria_slug),
    })),
    pizzarias: pizzarias.map((p) => p.slug),
  });
}

// Libera (ou retira) uma pizzaria de um usuário
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  if (!usuario.isAdmin) return json({ error: "Somente administradores" }, 403);

  const { userId, pizzaria, liberar } = (await request.json().catch(() => ({}))) as {
    userId?: string;
    pizzaria?: string;
    liberar?: boolean;
  };
  if (!userId || !pizzaria || !slugValido(pizzaria)) return json({ error: "Dados inválidos" }, 400);

  if (liberar) {
    await cardapioSql`INSERT INTO public.acessos_muvo (user_id, pizzaria_slug) VALUES (${userId}, ${pizzaria}) ON CONFLICT DO NOTHING`;
  } else {
    await cardapioSql`DELETE FROM public.acessos_muvo WHERE user_id = ${userId} AND pizzaria_slug = ${pizzaria}`;
  }
  return json({ ok: true });
}
