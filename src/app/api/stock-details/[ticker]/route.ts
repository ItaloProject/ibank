import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { fetchStockDetails } from "@/lib/stock-details";
import { TICKER_RE } from "@/lib/market-quotes";

/** Ficha enxuta da ação: segmento, dia, P/L, P/VP, dividendos e faixa do ano. */
export async function GET(_request: Request, context: { params: Promise<{ ticker: string }> }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const { ticker: raw } = await context.params;
  const ticker = decodeURIComponent(raw ?? "").trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  const details = await fetchStockDetails(ticker);
  if (!details) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(details);
}
