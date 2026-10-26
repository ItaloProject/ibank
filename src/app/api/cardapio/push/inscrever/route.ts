import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Guarda o aparelho do dono para receber as notificações de pedido novo */
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;

  const corpo = (await request.json().catch(() => null)) as {
    slug?: string;
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  } | null;
  const slug = corpo?.slug ?? "";
  const endpoint = corpo?.subscription?.endpoint ?? "";
  const p256dh = corpo?.subscription?.keys?.p256dh ?? "";
  const auth = corpo?.subscription?.keys?.auth ?? "";
  if (!slugValido(slug) || !endpoint.startsWith("https://") || !p256dh || !auth) {
    return json({ error: "Inscrição inválida" }, 400);
  }
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);

  await cardapioSql`
    INSERT INTO public.push_inscricoes (user_id, pizzaria_slug, endpoint, p256dh, auth)
    VALUES (${usuario.userId}, ${slug}, ${endpoint}, ${p256dh}, ${auth})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, pizzaria_slug = EXCLUDED.pizzaria_slug,
      p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
  return json({ ok: true });
}
