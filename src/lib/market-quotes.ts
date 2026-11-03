export type MarketQuote = {
  ticker: string;
  price: number;
  /** Soma dos proventos pagos por cota nos últimos 12 meses (R$). */
  dividends12m: number;
  /** Dividend yield de 12 meses sobre o preço atual (%). */
  dy12m: number;
  /** Horário (ms) do último negócio que originou o preço; null se a fonte não informar. */
  time: number | null;
};

export const TICKER_RE = /^[A-Z0-9]{4,7}$/;

/** O Yahoo já entrega a B3 com ~15 min de atraso; manter o cache curto evita somar mais defasagem. */
const QUOTE_REVALIDATE_S = 120;

type YahooChart = {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number; regularMarketTime?: number; currency?: string };
      events?: { dividends?: Record<string, { amount?: number; date?: number }> };
    }[];
  };
};

/** `fresh` ignora o cache e consulta o Yahoo na hora (botão de atualizar). */
export async function fetchYahooQuote(ticker: string, opts: { fresh?: boolean } = {}): Promise<MarketQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.SA?range=1y&interval=1mo&events=div`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MUVO/1.0)" },
      ...(opts.fresh ? { cache: "no-store" as const } : { next: { revalidate: QUOTE_REVALIDATE_S } }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as YahooChart;
    const result = json.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
    if (result?.meta?.currency && result.meta.currency !== "BRL") return null;
    const cutoff = Date.now() / 1000 - 365 * 24 * 3600;
    const dividends12m = Object.values(result?.events?.dividends ?? {})
      .filter((d) => typeof d.amount === "number" && (d.date ?? 0) >= cutoff)
      .reduce((s, d) => s + (d.amount ?? 0), 0);
    const t = result?.meta?.regularMarketTime;
    return {
      ticker,
      price,
      dividends12m,
      dy12m: (dividends12m / price) * 100,
      time: typeof t === "number" && Number.isFinite(t) ? t * 1000 : null,
    };
  } catch {
    return null;
  }
}
