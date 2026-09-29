"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getMarketQuotes } from "@/lib/api";
import { TICKER_RE } from "@/lib/market-quotes";
import {
  FII_CATALOG,
  FII_GROUPS,
  STOCK_CATALOG,
  STOCK_GROUPS,
  type CatalogEntry,
  type CatalogKind,
} from "@/lib/market-catalog";
import { FOCUS, INPUT_BOX, LABEL, MONEY, ROW } from "@/components/investimentos/live-ui";

const QUOTE_TTL_MS = 5 * 60 * 1000;
const QUOTE_BATCH = 40;
const quoteCache = new Map<string, { price: number; at: number }>();

/** Cotações de mercado dos tickers pedidos, com cache de 5 minutos entre aberturas da tela. */
function useCatalogQuotes(tickers: string[]) {
  const [prices, setPrices] = useState<Map<string, number>>(() => freshPrices(tickers));
  const [loading, setLoading] = useState(false);
  const key = tickers.join(",");

  useEffect(() => {
    const missing = tickers.filter((t) => {
      const hit = quoteCache.get(t);
      return !hit || Date.now() - hit.at > QUOTE_TTL_MS;
    });
    setPrices(freshPrices(tickers));
    if (missing.length === 0) return;
    let cancelled = false;
    setLoading(true);
    const batches: string[][] = [];
    for (let i = 0; i < missing.length; i += QUOTE_BATCH) batches.push(missing.slice(i, i + QUOTE_BATCH));
    Promise.all(batches.map((b) => getMarketQuotes(b)))
      .then((results) => {
        const now = Date.now();
        for (const q of results.flat()) if (q.price > 0) quoteCache.set(q.ticker, { price: q.price, at: now });
        if (!cancelled) setPrices(freshPrices(tickers));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { prices, loading };
}

function freshPrices(tickers: string[]) {
  const map = new Map<string, number>();
  for (const t of tickers) {
    const hit = quoteCache.get(t);
    if (hit) map.set(t, hit.price);
  }
  return map;
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const TOP = "Mais negociados";
const ALL = "Todos";

const COPY: Record<CatalogKind, { search: string; manual: string; manualHint: string }> = {
  acao: {
    search: "Buscar ação por nome ou código",
    manual: "Não achou? Digitar o código",
    manualHint: "Qualquer ação da bolsa, com quantidade e preço",
  },
  fii: {
    search: "Buscar fundo por nome ou código",
    manual: "Não achou? Digitar o código",
    manualHint: "Qualquer fundo imobiliário, com quantidade e preço",
  },
};

export function CatalogPicker({
  kind,
  knownPrices,
  onPick,
}: {
  kind: CatalogKind;
  /** Cotações já conhecidas (ex.: salvas da carteira), usadas enquanto a de mercado não chega. */
  knownPrices?: Map<string, number>;
  onPick: (asset: { ticker: string; name?: string; price?: number }) => void;
}) {
  const catalog = kind === "acao" ? STOCK_CATALOG : FII_CATALOG;
  const groups: readonly string[] = kind === "acao" ? STOCK_GROUPS : FII_GROUPS;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>(TOP);
  const tickers = useMemo(() => catalog.map((a) => a.ticker), [catalog]);
  const { prices, loading } = useCatalogQuotes(tickers);
  const copy = COPY[kind];

  const priceOf = (ticker: string) => prices.get(ticker) ?? knownPrices?.get(ticker);

  const q = normalize(query.trim());
  const searching = q.length > 0;
  const results = useMemo(() => {
    if (searching)
      return catalog.filter(
        (a) => normalize(a.ticker).includes(q) || normalize(a.name).includes(q) || normalize(a.group).includes(q),
      );
    if (filter === TOP) return catalog.filter((a) => a.top);
    if (filter === ALL) return catalog;
    return catalog.filter((a) => a.group === filter);
  }, [catalog, filter, q, searching]);

  const sections = useMemo(() => {
    if (searching || filter !== ALL) return [{ title: null as string | null, items: results }];
    return groups
      .map((g) => ({ title: g as string | null, items: results.filter((a) => a.group === g) }))
      .filter((s) => s.items.length > 0);
  }, [results, groups, filter, searching]);

  const typedTicker = query.trim().toUpperCase();
  const canTypeTicker = searching && results.length === 0 && TICKER_RE.test(typedTicker);

  function pick(a: CatalogEntry) {
    onPick({ ticker: a.ticker, name: a.name, price: priceOf(a.ticker) });
  }

  return (
    <div className="space-y-3">
      <label className={INPUT_BOX}>
        <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="sr-only">{copy.search}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpar busca"
            className={`h-7 w-7 -mr-1 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </label>

      {!searching && (
        <div role="tablist" aria-label="Filtrar por setor" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
          {[TOP, ALL, ...groups].map((g) => {
            const active = filter === g;
            return (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(g)}
                className={`shrink-0 min-h-9 rounded-full border px-3 text-xs font-bold whitespace-nowrap transition-colors ${FOCUS} ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-foreground/80 hover:bg-muted"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        {searching
          ? results.length === 0
            ? "Nenhum resultado na lista."
            : `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`
          : `${results.length} ${kind === "acao" ? (results.length === 1 ? "ação" : "ações") : results.length === 1 ? "fundo" : "fundos"}${
              loading ? " · atualizando cotações" : ""
            }`}
      </p>

      {sections.map((s) => (
        <div key={s.title ?? "lista"} className="space-y-2">
          {s.title && <p className={`${LABEL} pt-2`}>{s.title}</p>}
          {s.items.map((a) => {
            const price = priceOf(a.ticker);
            return (
              <button
                key={a.ticker}
                type="button"
                onClick={() => pick(a)}
                className={`${ROW} min-h-14 p-3.5 flex items-center justify-between gap-3`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground truncate">{a.ticker}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {a.name}
                    {!s.title && filter !== a.group ? ` · ${a.group}` : ""}
                  </span>
                </span>
                {price !== undefined ? (
                  <span className={`${MONEY} text-sm shrink-0`}>{formatCurrency(price)}</span>
                ) : loading ? (
                  <span className="h-4 w-16 rounded bg-muted animate-pulse shrink-0" aria-hidden="true" />
                ) : (
                  <span className="text-[11px] text-muted-foreground shrink-0">Sem cotação</span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onPick(canTypeTicker ? { ticker: typedTicker } : { ticker: "" })}
        className={`w-full min-h-14 rounded-xl border border-dashed border-border p-3.5 text-left flex items-center gap-2.5 hover:bg-muted/60 hover:border-foreground/30 transition-colors ${FOCUS}`}
      >
        <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Plus className="h-4 w-4 text-foreground/70" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-foreground">
            {canTypeTicker ? `Registrar compra de ${typedTicker}` : copy.manual}
          </span>
          <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{copy.manualHint}</span>
        </span>
      </button>
    </div>
  );
}
