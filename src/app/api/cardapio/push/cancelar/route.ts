import { NextResponse } from "next/server";
import cardapioSql from "@/lib/cardapio-db";
import { json, opcoes, usuarioCardapio } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Remove o aparelho do dono (quando ele desativa as notificações) */
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;

  const corpo = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  const endpoint = corpo?.endpoint ?? "";
  if (!endpoint.startsWith("https://")) return json({ error: "Inscrição inválida" }, 400);

  await cardapioSql`DELETE FROM public.push_inscricoes WHERE endpoint = ${endpoint} AND user_id = ${usuario.userId}`;
  return json({ ok: true });
}
