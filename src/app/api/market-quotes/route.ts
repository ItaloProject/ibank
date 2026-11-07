import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { fetchDayMove, fetchYahooQuote, TICKER_RE, type MarketQuote } from "@/lib/market-quotes";

/** Cotação e proventos de 12 meses dos tickers pedidos (B3, via Yahoo Finance). */
export async function GET(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const fresh = params.get("fresh") === "1";
  const raw = params.get("tickers") ?? "";
  const tickers = [...new Set(raw.split(",").map((t) => t.trim().toUpperCase()))].filter((t) => TICKER_RE.test(t)).slice(0, 40);
  if (tickers.length === 0) return NextResponse.json([]);
  // Preço e proventos, mais a variação do dia para a aba "Em alta".
  const quotes = await Promise.all(
    tickers.map(async (t): Promise<MarketQuote | null> => {
      const [quote, day] = await Promise.all([fetchYahooQuote(t, { fresh }), fetchDayMove(`${t}.SA`)]);
      return quote ? { ...quote, changePct: day?.changePct ?? null } : null;
    }),
  );
  return NextResponse.json(quotes.filter((q): q is MarketQuote => q !== null));
}
