import { NextResponse } from "next/server";
import { atualizarTesouro } from "@/lib/server/tesouro-live";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Atualiza as taxas do Tesouro Direto no banco (dias úteis, depois do fechamento do Tesouro).
 * A Vercel envia "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET ?? "";
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const data = await atualizarTesouro();
  return NextResponse.json({
    ok: !!data,
    date: data?.date ?? null,
    titulos: data ? Object.keys(data.rates).length : 0,
  });
}
