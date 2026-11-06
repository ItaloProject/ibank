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
  /** Preço ÷ valor patrimonial (P/VP). */
  pvp: number | null;
  /** Dividend yield 12 meses (%). */
  dividendYieldPct: number | null;
  ultimoProvento: number | null;
  /** Ex.: JCP, Dividendo. */
  ultimoProventoTipo: string | null;
  minimo52s: number | null;
  maximo52s: number | null;
  source: "brapi" | "catalog";
};

type BrapiQuote = {
  symbol?: string;
  shortName?: string | null;
  longName?: string | null;
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
      paymentDate?: string | null;
      exDate?: string | null;
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
  // Brapi às vezes manda 0.0769 (= 7,69%), às vezes já em %.
  return value > 0 && value <= 1 ? value * 100 : value;
}

function pickLastDividend(quote: BrapiQuote): { amount: number; tipo: string | null } | null {
  const rows = quote.dividendsData?.cashDividends;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // A API costuma vir do mais recente para o mais antigo.
  for (const row of rows) {
    if (typeof row.rate === "number" && Number.isFinite(row.rate) && row.rate > 0) {
      return { amount: row.rate, tipo: row.label ? String(row.label) : null };
    }
  }
  return null;
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

  const token = process.env.BRAPI_TOKEN?.trim();
  const qs = new URLSearchParams({
    dividends: "true",
    modules: "summaryProfile,defaultKeyStatistics",
  });
  if (token) qs.set("token", token);

  try {
    const res = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?${qs}`, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return base;
    const json = (await res.json()) as { results?: BrapiQuote[]; error?: boolean };
    const quote = Array.isArray(json.results) ? json.results[0] : null;
    if (!quote) return base;

    const profile = quote.summaryProfile;
    const stats = quote.defaultKeyStatistics;
    const industry = profile?.industryDisp || profile?.industry || null;
    const sector = profile?.sectorDisp || profile?.sector || null;
    const segmento = industry || sector || base.segmento;
    const lastDiv = pickLastDividend(quote);
    const pl =
      typeof stats?.trailingPE === "number" && Number.isFinite(stats.trailingPE)
        ? stats.trailingPE
        : typeof quote.priceEarnings === "number" && Number.isFinite(quote.priceEarnings)
          ? quote.priceEarnings
          : null;
    const dy = toPct(stats?.dividendYield ?? stats?.yield ?? null);

    return {
      ticker,
      name: (quote.longName || quote.shortName || base.name).toString(),
      segmento,
      variacaoDiaPct:
        typeof quote.regularMarketChangePercent === "number" && Number.isFinite(quote.regularMarketChangePercent)
          ? quote.regularMarketChangePercent
          : null,
      pl,
      pvp: typeof stats?.priceToBook === "number" && Number.isFinite(stats.priceToBook) ? stats.priceToBook : null,
      dividendYieldPct: dy,
      ultimoProvento: lastDiv?.amount ?? null,
      ultimoProventoTipo: lastDiv?.tipo ?? null,
      minimo52s: typeof quote.fiftyTwoWeekLow === "number" ? quote.fiftyTwoWeekLow : null,
      maximo52s: typeof quote.fiftyTwoWeekHigh === "number" ? quote.fiftyTwoWeekHigh : null,
      source: "brapi",
    };
  } catch {
    return base;
  }
}

export function formatMultiple(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ×`;
}

export function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
