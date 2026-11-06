import { FII_CATALOG } from "@/lib/market-catalog";
import { TICKER_RE } from "@/lib/market-quotes";

export type FiiDetails = {
  ticker: string;
  name: string;
  /** Ex.: Títulos e valores mobiliários */
  segmento: string | null;
  /** Ex.: Fundo de papel */
  tipoFundo: string | null;
  valPatrimonialCota: number | null;
  ultimoRendimento: number | null;
  /** Referência do rendimento, ex. "Outubro-2026". */
  ultimoRendimentoRef: string | null;
  valorPatrimonial: number | null;
  source: "brapi" | "catalog+yahoo" | "catalog";
};

const SEGMENTO_BY_GROUP: Record<string, string> = {
  "Recebíveis (papel)": "Títulos e valores mobiliários",
  "Logística e galpões": "Logística",
  Shoppings: "Shoppings",
  Escritórios: "Escritórios",
  "Renda urbana e híbridos": "Híbrido",
  "Fundos de fundos": "Fundo de fundos",
};

const TIPO_BY_GROUP: Record<string, string> = {
  "Recebíveis (papel)": "Fundo de papel",
  "Logística e galpões": "Fundo de tijolo",
  Shoppings: "Fundo de tijolo",
  Escritórios: "Fundo de tijolo",
  "Renda urbana e híbridos": "Fundo híbrido",
  "Fundos de fundos": "Fundo de fundos",
};

const TIPO_BY_SEGMENT: Record<string, string> = {
  papel: "Fundo de papel",
  tijolo: "Fundo de tijolo",
  hibrido: "Fundo híbrido",
  fof: "Fundo de fundos",
};

type BrapiIndicator = {
  symbol?: string;
  name?: string | null;
  navPerShare?: number | null;
  equity?: number | null;
  segmentType?: string | null;
  segmentoAtuacao?: string | null;
  mandate?: string | null;
};

type BrapiDividend = {
  symbol?: string;
  label?: string | null;
  rawRate?: number | null;
  rate?: number | null;
  relatedTo?: string | null;
  paymentDate?: string | null;
};

function catalogEntry(ticker: string) {
  return FII_CATALOG.find((a) => a.ticker === ticker) ?? null;
}

function catalogFallback(ticker: string): Pick<FiiDetails, "name" | "segmento" | "tipoFundo"> {
  const entry = catalogEntry(ticker);
  return {
    name: entry?.name ?? ticker,
    segmento: entry ? SEGMENTO_BY_GROUP[entry.group] ?? entry.group : null,
    tipoFundo: entry ? TIPO_BY_GROUP[entry.group] ?? null : null,
  };
}

async function fetchBrapiIndicators(ticker: string): Promise<BrapiIndicator | null> {
  const token = process.env.BRAPI_TOKEN?.trim();
  const qs = new URLSearchParams({ symbols: ticker });
  if (token) qs.set("token", token);
  try {
    const res = await fetch(`https://brapi.dev/api/v2/fii/indicators?${qs}`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { fiis?: BrapiIndicator[] };
    const row = Array.isArray(json.fiis) ? json.fiis.find((f) => String(f.symbol ?? "").toUpperCase() === ticker) : null;
    return row ?? null;
  } catch {
    return null;
  }
}

async function fetchBrapiLastDividend(ticker: string): Promise<{ amount: number; ref: string | null } | null> {
  const token = process.env.BRAPI_TOKEN?.trim();
  const qs = new URLSearchParams({ symbols: ticker, sortBy: "paymentDate", sortOrder: "desc" });
  if (token) qs.set("token", token);
  try {
    const res = await fetch(`https://brapi.dev/api/v2/fii/dividends?${qs}`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { dividends?: BrapiDividend[] };
    const rows = Array.isArray(json.dividends) ? json.dividends : [];
    const last = rows.find((d) => String(d.label ?? "").toUpperCase() === "RENDIMENTO" && (typeof d.rawRate === "number" || typeof d.rate === "number"));
    if (!last) return null;
    const amount = typeof last.rawRate === "number" ? last.rawRate : Number(last.rate);
    if (!Number.isFinite(amount)) return null;
    return { amount, ref: last.relatedTo ? String(last.relatedTo) : null };
  } catch {
    return null;
  }
}

/** Último provento no Yahoo (fallback quando a Brapi não cobre o ticker). */
async function fetchYahooLastDividend(ticker: string): Promise<{ amount: number; ref: string | null } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.SA?range=1y&interval=1mo&events=div`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MUVO/1.0)" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: { events?: { dividends?: Record<string, { amount?: number; date?: number }> } }[] };
    };
    const events = Object.values(json.chart?.result?.[0]?.events?.dividends ?? {});
    let best: { amount: number; date: number } | null = null;
    for (const d of events) {
      if (typeof d.amount !== "number" || !(d.amount > 0) || typeof d.date !== "number") continue;
      if (!best || d.date > best.date) best = { amount: d.amount, date: d.date };
    }
    if (!best) return null;
    const ref = new Date(best.date * 1000).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
    return { amount: best.amount, ref };
  } catch {
    return null;
  }
}

export async function fetchFiiDetails(rawTicker: string): Promise<FiiDetails | null> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) return null;

  const base = catalogFallback(ticker);
  const [indicator, dividend] = await Promise.all([fetchBrapiIndicators(ticker), fetchBrapiLastDividend(ticker)]);

  if (indicator) {
    const segmentType = String(indicator.segmentType ?? "").toLowerCase();
    // Catálogo curado vence o segmentoAtuacao da Brapi (às vezes vem inconsistente em fundos de papel).
    const segmento =
      base.segmento ||
      (indicator.segmentoAtuacao && String(indicator.segmentoAtuacao).trim()) ||
      (indicator.mandate && String(indicator.mandate).trim()) ||
      null;
    const tipoFundo = TIPO_BY_SEGMENT[segmentType] ?? base.tipoFundo;
    return {
      ticker,
      name: (indicator.name && String(indicator.name).trim()) || base.name,
      segmento,
      tipoFundo,
      valPatrimonialCota: typeof indicator.navPerShare === "number" && Number.isFinite(indicator.navPerShare) ? indicator.navPerShare : null,
      ultimoRendimento: dividend?.amount ?? null,
      ultimoRendimentoRef: dividend?.ref ?? null,
      valorPatrimonial: typeof indicator.equity === "number" && Number.isFinite(indicator.equity) ? indicator.equity : null,
      source: "brapi",
    };
  }

  const yahooDiv = await fetchYahooLastDividend(ticker);
  return {
    ticker,
    name: base.name,
    segmento: base.segmento,
    tipoFundo: base.tipoFundo,
    valPatrimonialCota: null,
    ultimoRendimento: yahooDiv?.amount ?? null,
    ultimoRendimentoRef: yahooDiv?.ref ?? null,
    valorPatrimonial: null,
    source: yahooDiv != null ? "catalog+yahoo" : "catalog",
  };
}

/** Formata patrimônio total no estilo Investidor10 (milhões / bilhões). */
export function formatPatrimonio(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `R$ ${(value / 1_000_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bilhões`;
  }
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} milhões`;
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
