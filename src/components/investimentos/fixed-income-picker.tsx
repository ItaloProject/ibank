"use client";

import { useMemo, useState } from "react";
import {
  FIXED_INCOME_REFERENCE_DATE,
  RENDA_FIXA_CATALOG,
  RENDA_FIXA_GROUPS,
  TESOURO_CATALOG,
  TESOURO_GROUPS,
  fixedRateLabel,
  type FixedIncomeEntry,
  type FixedIncomeKind,
} from "@/lib/fixed-income-catalog";
import { FilterChips, SearchBox, normalizeSearch } from "@/components/investimentos/catalog-picker";
import { LABEL, ROW } from "@/components/investimentos/live-ui";

const TOP = "Mais procurados";
const ALL = "Todos";

export function FixedIncomePicker({ kind, onPick }: { kind: FixedIncomeKind; onPick: (entry: FixedIncomeEntry) => void }) {
  const catalog = kind === "tesouro" ? TESOURO_CATALOG : RENDA_FIXA_CATALOG;
  const groups: readonly string[] = kind === "tesouro" ? TESOURO_GROUPS : RENDA_FIXA_GROUPS;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>(TOP);

  const q = normalizeSearch(query.trim());
  const searching = q.length > 0;
  const results = useMemo(() => {
    if (searching)
      return catalog.filter((e) => [e.nome, e.group, e.descricao, e.kind ?? ""].some((t) => normalizeSearch(t).includes(q)));
    if (filter === TOP) return catalog.filter((e) => e.top);
    if (filter === ALL) return catalog;
    return catalog.filter((e) => e.group === filter);
  }, [catalog, filter, q, searching]);

  const sections = useMemo(() => {
    if (searching || filter !== ALL) return [{ title: null as string | null, items: results }];
    return groups
      .map((g) => ({ title: g as string | null, items: results.filter((e) => e.group === g) }))
      .filter((s) => s.items.length > 0);
  }, [results, groups, filter, searching]);

  const noun = kind === "tesouro" ? ["título", "títulos"] : ["opção", "opções"];

  return (
    <div className="space-y-3">
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder={kind === "tesouro" ? "Buscar título ou ano (ex.: 2032)" : "Buscar CDB, LCI, LCA, debênture…"}
      />

      {!searching && <FilterChips label="Filtrar por tipo" options={[TOP, ALL, ...groups]} value={filter} onChange={setFilter} />}

      <p className="text-[11px] text-muted-foreground leading-snug" aria-live="polite">
        {searching && results.length === 0
          ? "Nenhum resultado na lista."
          : `${results.length} ${results.length === 1 ? noun[0] : noun[1]} · ${
              kind === "tesouro" ? "taxas de compra" : "taxas típicas"
            } de ${FIXED_INCOME_REFERENCE_DATE}. Você informa a taxa que conseguiu ao confirmar.`}
      </p>

      {sections.map((s) => (
        <div key={s.title ?? "lista"} className="space-y-2">
          {s.title && <p className={`${LABEL} pt-2`}>{s.title}</p>}
          {s.items.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPick(e)}
              className={`${ROW} min-h-14 p-3.5 flex items-start justify-between gap-3`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">{e.nome}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{e.descricao}</span>
              </span>
              <span className="text-xs font-bold tabular-nums text-foreground shrink-0 text-right">
                {fixedRateLabel(e.rate_index, e.rate_value)}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
