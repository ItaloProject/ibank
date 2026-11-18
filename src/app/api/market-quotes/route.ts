import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { fetchYahooQuote, TICKER_RE, type MarketQuote } from "@/lib/market-quotes";
import { limitar } from "@/lib/rate-limit";

/** Cotação e proventos de 12 meses dos tickers pedidos (B3, via Yahoo Finance). */
export async function GET(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  // Uma chamada Yahoo por ticker (preço + day move no mesmo JSON).
  const limite = await limitar({ chave: `quotes:${auth.userId}`, max: 40, janelaSeg: 60 });
  if (!limite.ok) {
    return NextResponse.json({ error: "Muitas consultas de cotação. Tente de novo em instantes." }, { status: 429, headers: { "Retry-After": String(limite.retryAfter) } });
  }
  const params = new URL(request.url).searchParams;
  const fresh = params.get("fresh") === "1";
  const raw = params.get("tickers") ?? "";
  const tickers = [...new Set(raw.split(",").map((t) => t.trim().toUpperCase()))].filter((t) => TICKER_RE.test(t)).slice(0, 40);
  if (tickers.length === 0) return NextResponse.json([]);
  const quotes = await Promise.all(tickers.map((t) => fetchYahooQuote(t, { fresh })));
  return NextResponse.json(quotes.filter((q): q is MarketQuote => q !== null));
}
