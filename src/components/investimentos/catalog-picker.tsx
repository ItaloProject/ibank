"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Plus, RefreshCw, Search, X } from "lucide-react";
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
import { FOCUS, INPUT_BOX, LABEL, LiveSheet, MONEY, ROW } from "@/components/investimentos/live-ui";
import { FiiDetailsSheet } from "@/components/investimentos/fii-details-sheet";

const QUOTE_TTL_MS = 2 * 60 * 1000;
const QUOTE_BATCH = 40;
const quoteCache = new Map<string, { price: number; at: number; time: number | null }>();

/** Cotações de mercado dos tickers pedidos, com cache de 2 minutos entre aberturas da tela e atualização sob demanda. */
function useCatalogQuotes(tickers: string[]) {
  const [prices, setPrices] = useState<Map<string, number>>(() => freshPrices(tickers));
  const [asOf, setAsOf] = useState<number | null>(() => latestQuoteTime(tickers));
  const [loading, setLoading] = useState(false);
  const key = tickers.join(",");
  const run = useRef(0);

  const load = useCallback(
    async (force: boolean) => {
      const id = ++run.current;
      const missing = force
        ? tickers
        : tickers.filter((t) => {
            const hit = quoteCache.get(t);
            return !hit || Date.now() - hit.at > QUOTE_TTL_MS;
          });
      setPrices(freshPrices(tickers));
      setAsOf(latestQuoteTime(tickers));
      if (missing.length === 0) return;
      setLoading(true);
      const batches: string[][] = [];
      for (let i = 0; i < missing.length; i += QUOTE_BATCH) batches.push(missing.slice(i, i + QUOTE_BATCH));
      try {
        const results = await Promise.all(batches.map((b) => getMarketQuotes(b, force)));
        const now = Date.now();
        for (const q of results.flat()) if (q.price > 0) quoteCache.set(q.ticker, { price: q.price, at: now, time: q.time ?? null });
        if (id === run.current) {
          setPrices(freshPrices(tickers));
          setAsOf(latestQuoteTime(tickers));
        }
      } finally {
        if (id === run.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    void load(false);
    return () => {
      run.current += 1;
    };
  }, [load]);

  return { prices, loading, asOf, refresh: () => load(true) };
}

function freshPrices(tickers: string[]) {
  const map = new Map<string, number>();
  for (const t of tickers) {
    const hit = quoteCache.get(t);
    if (hit) map.set(t, hit.price);
  }
  return map;
}

/** Horário do negócio mais recente entre as cotações em cache. */
function latestQuoteTime(tickers: string[]): number | null {
  let latest: number | null = null;
  for (const t of tickers) {
    const time = quoteCache.get(t)?.time;
    if (time && (latest === null || time > latest)) latest = time;
  }
  return latest;
}

function formatAsOf(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `Cotações das ${time}`;
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `Cotações de ${date} às ${time}`;
}

export function normalizeSearch(text: string) {
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
  const [infoAsset, setInfoAsset] = useState<CatalogEntry | null>(null);
  const tickers = useMemo(() => catalog.map((a) => a.ticker), [catalog]);
  const { prices, loading, asOf, refresh } = useCatalogQuotes(tickers);
  const copy = COPY[kind];

  const priceOf = (ticker: string) => prices.get(ticker) ?? knownPrices?.get(ticker);

  const q = normalizeSearch(query.trim());
  const searching = q.length > 0;
  const results = useMemo(() => {
    if (searching)
      return catalog.filter(
        (a) => normalizeSearch(a.ticker).includes(q) || normalizeSearch(a.name).includes(q) || normalizeSearch(a.group).includes(q),
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
      <SearchBox value={query} onChange={setQuery} placeholder={copy.search} />

      {!searching && <FilterChips label="Filtrar por setor" options={[TOP, ALL, ...groups]} value={filter} onChange={setFilter} />}

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-[11px] text-muted-foreground" aria-live="polite">
          {searching
            ? results.length === 0
              ? "Nenhum resultado na lista."
              : `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`
            : `${results.length} ${kind === "acao" ? (results.length === 1 ? "ação" : "ações") : results.length === 1 ? "fundo" : "fundos"}`}
          {loading ? " · atualizando cotações" : asOf ? ` · ${formatAsOf(asOf)}` : ""}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Atualizar cotações"
          title="Atualizar cotações. A B3 chega com cerca de 15 minutos de atraso."
          className={`-my-2 -mr-2 h-10 w-10 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 ${FOCUS}`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {sections.map((s) => (
        <div key={s.title ?? "lista"} className="space-y-2">
          {s.title && <p className={`${LABEL} pt-2`}>{s.title}</p>}
          {s.items.map((a) => {
            const price = priceOf(a.ticker);
            return (
              <div key={a.ticker} className={`${ROW} min-h-14 p-0 flex items-stretch overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => pick(a)}
                  className={`min-w-0 flex-1 p-3.5 flex items-center justify-between gap-3 text-left ${FOCUS}`}
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
                <button
                  type="button"
                  onClick={() => setInfoAsset(a)}
                  aria-label={`Ver detalhes de ${a.ticker}`}
                  title="Ver detalhes"
                  className={`shrink-0 w-11 border-l border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`}
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
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

      {kind === "fii" ? (
        <FiiDetailsSheet ticker={infoAsset?.ticker ?? null} name={infoAsset?.name} onClose={() => setInfoAsset(null)} />
      ) : (
        <LiveSheet
          open={!!infoAsset}
          onOpenChange={(o) => !o && setInfoAsset(null)}
          title={infoAsset?.ticker ?? ""}
          description={infoAsset?.name}
        >
          {infoAsset && (
            <div className="space-y-2.5">
              <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 flex items-start justify-between gap-3">
                <span className={`${LABEL} pt-0.5`}>Segmento</span>
                <span className={`${MONEY} text-sm text-right leading-snug`}>{infoAsset.group}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Tipo de fundo, valor patrimonial e último rendimento aparecem na ficha dos fundos imobiliários.
              </p>
              <button
                type="button"
                onClick={() => setInfoAsset(null)}
                className={`mt-2 w-full min-h-12 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors ${FOCUS}`}
              >
                Fechar
              </button>
            </div>
          )}
        </LiveSheet>
      )}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className={INPUT_BOX}>
      <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className={`h-7 w-7 -mr-1 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </label>
  );
}

export function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [options.length]);

  function scrollBy(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: smooth ? "smooth" : "auto" });
  }

  const arrow =
    "absolute top-0 z-10 flex h-9 w-16 items-center text-foreground transition-colors hover:text-foreground/70 " + FOCUS;

  return (
    <div className="relative">
      <div ref={scroller} role="tablist" aria-label={label} className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 scrollbar-none">
        {options.map((g) => {
          const active = value === g;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(g)}
              className={`shrink-0 min-h-9 rounded-full border px-3 text-xs font-bold whitespace-nowrap transition-colors ${FOCUS} ${
                active ? "border-foreground bg-foreground text-background" : "border-border text-foreground/80 hover:bg-muted"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>
      {edges.left && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Ver filtros anteriores"
          onClick={() => scrollBy(-1)}
          className={`${arrow} -left-5 justify-start pl-5 bg-gradient-to-r from-background via-background/90 to-transparent`}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Ver mais filtros"
          onClick={() => scrollBy(1)}
          className={`${arrow} -right-5 justify-end pr-5 bg-gradient-to-l from-background via-background/90 to-transparent`}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}