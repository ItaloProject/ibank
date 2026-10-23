import { NextResponse } from "next/server";
import cardapioSql, { SUPABASE_URL, slugValido } from "@/lib/cardapio-db";
import { json, opcoes, usuarioCardapio } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

const LIMITE = 8 * 1024 * 1024;

// Envia logo ou foto de um item para o Storage do cardápio. A chave de serviço fica só no servidor.
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const tipo = url.searchParams.get("tipo") === "logo" ? "logo" : "foto";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);

  if (!usuario.isAdmin) {
    const rows = await cardapioSql`SELECT 1 FROM public.acessos_muvo WHERE user_id = ${usuario.userId} AND pizzaria_slug = ${slug}`;
    if (rows.length === 0) return json({ error: "Sem permissão" }, 403);
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > LIMITE) return json({ error: "Imagem vazia ou grande demais" }, 400);

  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave || !SUPABASE_URL) return json({ error: "Storage não configurado" }, 500);

  const caminho = `${slug}/${tipo}-${Date.now().toString(36)}.webp`;
  const envio = await fetch(`${SUPABASE_URL}/storage/v1/object/fotos/${caminho}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, apikey: chave, "Content-Type": "image/webp", "x-upsert": "false" },
    body: bytes,
  });
  if (!envio.ok) return json({ error: "Falha ao enviar a imagem" }, 502);

  return json({ url: `${SUPABASE_URL}/storage/v1/object/public/fotos/${caminho}` });
}
