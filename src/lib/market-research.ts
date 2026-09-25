export type MarketRates = {
  selicAnual: number;
  cdiAnual: number;
  /** IPCA acumulado em 12 meses (% a.a.). */
  ipca12m?: number;
  /** Mediana do Boletim Focus: Selic no fim de cada ano e IPCA de cada ano (% a.a.). */
  focus?: FocusExpectations;
  updatedAt: string;
  source: "bcb" | "fallback";
};

export type FocusYear = { ano: number; valor: number };
export type FocusExpectations = { data: string; selic: FocusYear[]; ipca: FocusYear[] };

export type FiiResearchItem = {
  ticker: string;
  tipo: string;
  perfil: string;
  risco: string;
  price: number | null;
  dyMensalPct: number | null;
  dy12mPct: number | null;
  pvp: number | null;
  source: "brapi" | "yahoo+estimado" | "estimado";
};

export type MarketResearchPayload = {
  rates: MarketRates;
  fiis: FiiResearchItem[];
  fetchedAt: string;
};

const SELIC_URL =
  "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json";
const CDI_URL =
  "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json";
const IPCA_12M_URL =
  "https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json";

/** Metadados curados + DY mensal estimado quando a API não cobrir o ticker. */
const FII_BASE: Omit<FiiResearchItem, "price" | "dyMensalPct" | "dy12mPct" | "pvp" | "source">[] = [
  { ticker: "MXRF11", tipo: "Recebíveis", perfil: "Alto rendimento, liquidez", risco: "Médio" },
  { ticker: "XPML11", tipo: "Shopping", perfil: "Renda estável + valorização", risco: "Baixo-médio" },
  { ticker: "HGLG11", tipo: "Logística", perfil: "Qualidade de ativos", risco: "Baixo" },
  { ticker: "KNCR11", tipo: "Papel (CRI)", perfil: "Inflação + CDI", risco: "Médio" },
  { ticker: "VISC11", tipo: "Shopping", perfil: "Dividendos consistentes", risco: "Baixo-médio" },
  { ticker: "BTLG11", tipo: "Logística", perfil: "Crescimento setorial", risco: "Baixo" },
  { ticker: "TRXF11", tipo: "Híbrido", perfil: "Diversificado", risco: "Médio" },
  { ticker: "IRDM11", tipo: "Papel", perfil: "Alto DY, mais volatilidade", risco: "Médio-alto" },
];

const DY_ESTIMADO_MENSAL: Record<string, number> = {
  MXRF11: 1.1,
  XPML11: 0.75,
  HGLG11: 0.7,
  KNCR11: 1.0,
  VISC11: 0.8,
  BTLG11: 0.75,
  TRXF11: 0.9,
  IRDM11: 1.05,
};

/** Sandbox gratuito da Brapi cobre só estes tickers sem token. */
const BRAPI_SANDBOX_FIIS = ["MXRF11", "HGLG11"];

async function fetchBcbSerie(url: string): Promise<{ data: string; valor: number } | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const last = rows[rows.length - 1];
    return { data: String(last.data), valor: Number(String(last.valor).replace(",", ".")) };
  } catch {
    return null;
  }
}

const FOCUS_URL =
  "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais" +
  "?$top=60&$filter=(Indicador%20eq%20'Selic'%20or%20Indicador%20eq%20'IPCA')%20and%20baseCalculo%20eq%200" +
  "&$orderby=Data%20desc&$format=json&$select=Indicador,Data,DataReferencia,Mediana";

type FocusRow = { Indicador: string; Data: string; DataReferencia: string; Mediana: number };

/** Última divulgação do Focus para cada indicador (mediana por ano de referência). */
export async function fetchFocus(): Promise<FocusExpectations | undefined> {
  try {
    const res = await fetch(FOCUS_URL, { next: { revalidate: 21600 } });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { value?: FocusRow[] };
    const rows = Array.isArray(json.value) ? json.value : [];
    const pick = (indicador: string): FocusYear[] => {
      const own = rows.filter((r) => r.Indicador === indicador && Number.isFinite(Number(r.Mediana)));
      if (own.length === 0) return [];
      const latest = own[0].Data;
      return own
        .filter((r) => r.Data === latest)
        .map((r) => ({ ano: Number(r.DataReferencia), valor: Number(r.Mediana) }))
        .filter((r) => Number.isInteger(r.ano))
        .sort((a, b) => a.ano - b.ano);
    };
    const selic = pick("Selic");
    const ipca = pick("IPCA");
    if (selic.length === 0 && ipca.length === 0) return undefined;
    const data = rows.find((r) => r.Indicador === "Selic")?.Data ?? rows[0]?.Data ?? "";
    return { data, selic, ipca };
  } catch {
    return undefined;
  }
}

export async function fetchMarketRates(): Promise<MarketRates> {
  const [selic, cdi, ipca, focus] = await Promise.all([
    fetchBcbSerie(SELIC_URL),
    fetchBcbSerie(CDI_URL),
    fetchBcbSerie(IPCA_12M_URL),
    fetchFocus(),
  ]);
  if (selic) {
    return {
      selicAnual: selic.valor,
      cdiAnual: cdi?.valor ?? Math.max(selic.valor - 0.1, 0),
      ipca12m: ipca && Number.isFinite(ipca.valor) ? ipca.valor : undefined,
      focus,
      updatedAt: selic.data,
      source: "bcb",
    };
  }
  return {
    selicAnual: 15.0,
    cdiAnual: 14.9,
    focus,
    updatedAt: new Date().toLocaleDateString("pt-BR"),
    source: "fallback",
  };
}

async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.SA?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MUVO/1.0)" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

type BrapiFiiRow = {
  symbol?: string;
  ticker?: string;
  price?: number;
  priceToNav?: number;
  pvp?: number;
  dividendYield12m?: number;
  dividendYield1m?: number;
};

/** Brapi devolve DY como fração (0.0108 ≈ 1,08%). Se vier > 1, assume % já. */
function toPercent(value: number | undefined | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value <= 1 ? value * 100 : value;
}

async function fetchBrapiFiiIndicators(tickers: string[]): Promise<Map<string, BrapiFiiRow>> {
  const map = new Map<string, BrapiFiiRow>();
  if (tickers.length === 0) return map;

  const token = process.env.BRAPI_TOKEN?.trim();
  const qs = new URLSearchParams({ symbols: tickers.join(",") });
  if (token) qs.set("token", token);

  try {
    const res = await fetch(`https://brapi.dev/api/v2/fii/indicators?${qs}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return map;
    const json = await res.json();
    const rows: BrapiFiiRow[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.fiis)
        ? json.fiis
        : Array.isArray(json?.data)
          ? json.data
          : [];
    for (const row of rows) {
      const t = String(row.symbol ?? row.ticker ?? "").toUpperCase();
      if (t) map.set(t, row);
    }
  } catch {
    /* ignore — fallbacks below */
  }
  return map;
}

function formatDyMensal(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "n/d";
  return `${pct.toFixed(2).replace(".", ",")}%/mês`;
}

export function formatFiiDyLabel(item: FiiResearchItem): string {
  return formatDyMensal(item.dyMensalPct);
}

export async function buildMarketResearch(): Promise<MarketResearchPayload> {
  const rates = await fetchMarketRates();

  const token = process.env.BRAPI_TOKEN?.trim();
  const brapiTickers = token
    ? FII_BASE.map((f) => f.ticker)
    : BRAPI_SANDBOX_FIIS;

  const [brapiMap, ...yahooPrices] = await Promise.all([
    fetchBrapiFiiIndicators(brapiTickers),
    ...FII_BASE.map((f) => fetchYahooPrice(f.ticker)),
  ]);

  const fiis: FiiResearchItem[] = FII_BASE.map((base, i) => {
    const yahoo = yahooPrices[i] ?? null;
    const live = brapiMap.get(base.ticker);
    if (live) {
      const dy1m = toPercent(live.dividendYield1m);
      const dy12 = toPercent(live.dividendYield12m);
      const dyMensal = dy1m ?? (dy12 != null ? dy12 / 12 : null);
      const pvp =
        typeof live.priceToNav === "number"
          ? live.priceToNav
          : typeof live.pvp === "number"
            ? live.pvp
            : null;
      return {
        ...base,
        price: typeof live.price === "number" ? live.price : yahoo,
        dyMensalPct: dyMensal,
        dy12mPct: dy12,
        pvp,
        source: "brapi" as const,
      };
    }

    const estimado = DY_ESTIMADO_MENSAL[base.ticker] ?? null;
    return {
      ...base,
      price: yahoo,
      dyMensalPct: estimado,
      dy12mPct: estimado != null ? estimado * 12 : null,
      pvp: null,
      source: yahoo != null ? ("yahoo+estimado" as const) : ("estimado" as const),
    };
  });

  return {
    rates,
    fiis,
    fetchedAt: new Date().toISOString(),
  };
}
