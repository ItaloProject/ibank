import { STOCK_CATALOG } from "@/lib/market-catalog";
import { TICKER_RE } from "@/lib/market-quotes";

export type StockDetails = {
  ticker: string;
  name: string;
  /** Setor / indústria em linguagem simples. */
  segmento: string | null;
  /** Variação % do pregão. */
  variacaoDiaPct: number | null;
  /** Preço ÷ lucro (P/L). */
  pl: number | null;
  /** Preço ÷ valor patrimonial (P/VP). Só em planos Brapi pagos. */
  pvp: number | null;
  /** Dividend yield 12 meses (%). */
  dividendYieldPct: number | null;
  ultimoProvento: number | null;
  /** Ex.: JCP, Dividendo. */
  ultimoProventoTipo: string | null;
  minimo52s: number | null;
  maximo52s: number | null;
  source: "brapi" | "brapi+yahoo" | "catalog";
};

type BrapiQuote = {
  symbol?: string;
  shortName?: string | null;
  longName?: string | null;
  regularMarketPrice?: number | null;
  regularMarketChangePercent?: number | null;
  priceEarnings?: number | null;
  fiftyTwoWeekLow?: number | null;
  fiftyTwoWeekHigh?: number | null;
  summaryProfile?: {
    sectorDisp?: string | null;
    industryDisp?: string | null;
    sector?: string | null;
    industry?: string | null;
  } | null;
  defaultKeyStatistics?: {
    trailingPE?: number | null;
    priceToBook?: number | null;
    dividendYield?: number | null;
    yield?: number | null;
  } | null;
  dividendsData?: {
    cashDividends?: {
      rate?: number | null;
      label?: string | null;
    }[];
  } | null;
};

function catalogName(ticker: string): string {
  return STOCK_CATALOG.find((a) => a.ticker === ticker)?.name ?? ticker;
}

function catalogSegmento(ticker: string): string | null {
  return STOCK_CATALOG.find((a) => a.ticker === ticker)?.group ?? null;
}

function toPct(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value > 0 && value <= 1 ? value * 100 : value;
}

function pickLastDividend(quote: BrapiQuote): { amount: number; tipo: string | null } | null {
  const rows = quote.dividendsData?.cashDividends;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  for (const row of rows) {
    if (typeof row.rate === "number" && Number.isFinite(row.rate) && row.rate > 0) {
      return { amount: row.rate, tipo: row.label ? String(row.label) : null };
    }
  }
  return null;
}

/** Plano grátis: cotação + summaryProfile. Startup/Pro: dividends e defaultKeyStatistics. */
async function fetchBrapiQuote(ticker: string): Promise<BrapiQuote | null> {
  const token = process.env.BRAPI_TOKEN?.trim();
  const attempts: Record<string, string>[] = [
    { dividends: "true", modules: "summaryProfile,defaultKeyStatistics" },
    { modules: "summaryProfile" },
    {},
  ];

  for (const extra of attempts) {
    const qs = new URLSearchParams(extra);
    if (token) qs.set("token", token);
    try {
      const res = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?${qs}`, {
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { results?: BrapiQuote[]; error?: boolean; message?: string };
      if (json.error || !Array.isArray(json.results) || !json.results[0]) continue;
      return json.results[0];
    } catch {
      /* tenta o próximo recorte do plano */
    }
  }
  return null;
}

/** Último provento e DY 12m pelo Yahoo (quando a Brapi grátis não libera dividends). */
async function fetchYahooDividends(ticker: string): Promise<{
  last: number | null;
  dy12m: number | null;
  price: number | null;
}> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.SA?range=1y&interval=1mo&events=div`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MUVO/1.0)" },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { last: null, dy12m: null, price: null };
    const json = (await res.json()) as {
      chart?: {
        result?: {
          meta?: { regularMarketPrice?: number };
          events?: { dividends?: Record<string, { amount?: number; date?: number }> };
        }[];
      };
    };
    const result = json.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice ?? null;
    const events = Object.values(result?.events?.dividends ?? {});
    let last: { amount: number; date: number } | null = null;
    let sum = 0;
    const cutoff = Date.now() / 1000 - 365 * 24 * 3600;
    for (const d of events) {
      if (typeof d.amount !== "number" || !(d.amount > 0) || typeof d.date !== "number") continue;
      if (d.date >= cutoff) sum += d.amount;
      if (!last || d.date > last.date) last = { amount: d.amount, date: d.date };
    }
    return {
      last: last?.amount ?? null,
      dy12m: typeof price === "number" && price > 0 && sum > 0 ? (sum / price) * 100 : null,
      price: typeof price === "number" ? price : null,
    };
  } catch {
    return { last: null, dy12m: null, price: null };
  }
}

export async function fetchStockDetails(rawTicker: string): Promise<StockDetails | null> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) return null;

  const base: StockDetails = {
    ticker,
    name: catalogName(ticker),
    segmento: catalogSegmento(ticker),
    variacaoDiaPct: null,
    pl: null,
    pvp: null,
    dividendYieldPct: null,
    ultimoProvento: null,
    ultimoProventoTipo: null,
    minimo52s: null,
    maximo52s: null,
    source: "catalog",
  };

  const [quote, yahoo] = await Promise.all([fetchBrapiQuote(ticker), fetchYahooDividends(ticker)]);
  if (!quote && yahoo.last == null && yahoo.dy12m == null) return base;

  const profile = quote?.summaryProfile;
  const stats = quote?.defaultKeyStatistics;
  const industry = profile?.industryDisp || profile?.industry || null;
  const sector = profile?.sectorDisp || profile?.sector || null;
  const brapiDiv = quote ? pickLastDividend(quote) : null;
  const pl =
    typeof stats?.trailingPE === "number" && Number.isFinite(stats.trailingPE)
      ? stats.trailingPE
      : typeof quote?.priceEarnings === "number" && Number.isFinite(quote.priceEarnings)
        ? quote.priceEarnings
        : null;
  const dy = toPct(stats?.dividendYield ?? stats?.yield ?? null) ?? yahoo.dy12m;

  return {
    ticker,
    name: (quote?.longName || quote?.shortName || base.name).toString(),
    segmento: industry || sector || base.segmento,
    variacaoDiaPct:
      typeof quote?.regularMarketChangePercent === "number" && Number.isFinite(quote.regularMarketChangePercent)
        ? quote.regularMarketChangePercent
        : null,
    pl,
    pvp: typeof stats?.priceToBook === "number" && Number.isFinite(stats.priceToBook) ? stats.priceToBook : null,
    dividendYieldPct: dy,
    ultimoProvento: brapiDiv?.amount ?? yahoo.last,
    ultimoProventoTipo: brapiDiv?.tipo ?? null,
    minimo52s: typeof quote?.fiftyTwoWeekLow === "number" ? quote.fiftyTwoWeekLow : null,
    maximo52s: typeof quote?.fiftyTwoWeekHigh === "number" ? quote.fiftyTwoWeekHigh : null,
    source: quote && (yahoo.last != null || yahoo.dy12m != null) ? "brapi+yahoo" : quote ? "brapi" : "catalog",
  };
}

export function formatMultiple(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ×`;
}

export function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
