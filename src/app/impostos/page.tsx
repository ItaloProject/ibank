"use client";

import { useEffect, useState, useMemo } from "react";
import { getStockTrades } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { StockTrade } from "@/types/database";
import {
  computeMonthlyTax, currentLossPool, darfDueDate,
  CATEGORY_META, EXEMPTION_LIMIT, DARF_CODE, DARF_MINIMUM,
  type MonthlyTax, type TaxCategory,
} from "@/lib/tax-ir";
import {
  AlertTriangle, CheckCircle2, ChevronDown, Loader2,
  TrendingDown, Info, Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

const CAT_COLOR: Record<TaxCategory, string> = {
  acoes: "text-blue-500 bg-blue-500/10",
  fii:   "text-amber-500 bg-amber-500/10",
  etf:   "text-purple-500 bg-purple-500/10",
};

function monthLabel(m: string) {
  return format(new Date(m + "-01"), "MMMM 'de' yyyy", { locale: ptBR });
}

export default function ImpostosPage() {
  const [trades, setTrades] = useState<StockTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [year, setYear] = useState<string>("todos");

  useEffect(() => {
    getStockTrades()
      .then((t) => setTrades(Array.isArray(t) ? (t as StockTrade[]) : []))
      .finally(() => setLoading(false));
  }, []);

  const allRows = useMemo(() => computeMonthlyTax(trades), [trades]);
  const lossPool = useMemo(() => currentLossPool(allRows), [allRows]);

  const years = useMemo(() => {
    const set = new Set(allRows.map((r) => r.month.slice(0, 4)));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [allRows]);

  const rows = year === "todos" ? allRows : allRows.filter((r) => r.month.startsWith(year));

  const totalDevido = rows.reduce((s, r) => s + r.taxDue, 0);
  const mesesComImposto = rows.filter((r) => r.taxDue >= DARF_MINIMUM).length;
  const totalPrejuizo = Object.values(lossPool).reduce((s, v) => s + v, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Imposto de Renda" description="Ganho de capital em renda variável" />

      <PageBody width="medium">
        {allRows.length === 0 ? (
          <div className="rounded-2xl border bg-card py-14 text-center px-6">
            <Receipt className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhuma venda registrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              O imposto só é apurado quando você vende um ativo. Registre suas vendas em Investimentos.
            </p>
          </div>
        ) : (
          <>
            {/* Filtro de ano */}
            {years.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {["todos", ...years].map((y) => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
                      year === y ? "bg-foreground text-background" : "border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {y === "todos" ? "Todos" : y}
                  </button>
                ))}
              </div>
            )}

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border bg-card px-4 py-3.5">
                <p className="text-[11px] text-muted-foreground">Total devido</p>
                <p className={cn("text-lg font-bold tabular-nums mt-0.5", totalDevido > 0 ? "text-amber-500" : "text-foreground")}>
                  {formatCurrency(totalDevido)}
                </p>
              </div>
              <div className="rounded-2xl border bg-card px-4 py-3.5">
                <p className="text-[11px] text-muted-foreground">DARFs a pagar</p>
                <p className="text-lg font-bold tabular-nums mt-0.5">{mesesComImposto}</p>
              </div>
              <div className="rounded-2xl border bg-card px-4 py-3.5">
                <p className="text-[11px] text-muted-foreground">Prejuízo a compensar</p>
                <p className={cn("text-lg font-bold tabular-nums mt-0.5", totalPrejuizo > 0 ? "text-emerald-500" : "text-muted-foreground")}>
                  {formatCurrency(totalPrejuizo)}
                </p>
              </div>
            </div>

            {/* Prejuízo acumulado por categoria */}
            {totalPrejuizo > 0 && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-emerald-500 shrink-0" />
                  <p className="text-sm font-semibold">Prejuízo disponível para compensar</p>
                </div>
                <div className="space-y-1.5">
                  {(Object.keys(lossPool) as TaxCategory[])
                    .filter((c) => lossPool[c] > 0)
                    .map((c) => (
                      <div key={c} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{CATEGORY_META[c].label}</span>
                        <span className="text-xs font-semibold tabular-nums text-emerald-500">
                          {formatCurrency(lossPool[c])}
                        </span>
                      </div>
                    ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  Abate lucros futuros da mesma categoria, sem prazo de validade. Prejuízo de FII só compensa FII.
                </p>
              </div>
            )}

            {/* Lista de apurações */}
            <div className="space-y-2">
              {rows.map((r) => (
                <TaxRow
                  key={`${r.month}-${r.category}`}
                  row={r}
                  open={expanded === `${r.month}-${r.category}`}
                  onToggle={() =>
                    setExpanded((prev) =>
                      prev === `${r.month}-${r.category}` ? null : `${r.month}-${r.category}`,
                    )
                  }
                />
              ))}
            </div>
          </>
        )}

        {/* Aviso */}
        <div className="rounded-2xl border bg-muted/30 px-4 py-3.5 flex gap-2.5">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1">
            <p>
              Cálculo estimado por custo médio, considerando todas as operações como swing trade.
              Não cobre day trade (20%), IR retido na fonte (dedo-duro) nem operações fora deste app.
            </p>
            <p>Confirme com seu contador antes de recolher. Código DARF de renda variável: <strong className="text-foreground">{DARF_CODE}</strong>. Dispensado abaixo de {formatCurrency(DARF_MINIMUM)}.</p>
          </div>
        </div>
      </PageBody>
    </PageShell>
  );
}

function TaxRow({ row, open, onToggle }: { row: MonthlyTax; open: boolean; onToggle: () => void }) {
  const meta = CATEGORY_META[row.category];
  const devido = row.taxDue >= DARF_MINIMUM;
  const prejuizo = row.grossProfit < 0;

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden transition-colors",
      devido && "border-amber-500/40",
    )}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors">
        {/* Status */}
        <div className="shrink-0">
          {devido
            ? <AlertTriangle className="h-4 w-4 text-amber-500" />
            : prejuizo
              ? <TrendingDown className="h-4 w-4 text-emerald-500" />
              : <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold capitalize">{monthLabel(row.month)}</span>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide", CAT_COLOR[row.category])}>
              {meta.label}
            </span>
            {row.exempt && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-emerald-500/10 text-emerald-500">
                isento
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Vendeu {formatCurrency(row.totalSales)} · {row.sales.length} venda{row.sales.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="text-right shrink-0">
          {devido ? (
            <>
              <p className="text-sm font-bold tabular-nums text-amber-500">{formatCurrency(row.taxDue)}</p>
              <p className="text-[10px] text-muted-foreground">vence {format(new Date(darfDueDate(row.month) + "T00:00:00"), "dd/MM/yy")}</p>
            </>
          ) : (
            <p className={cn("text-sm font-semibold tabular-nums", prejuizo ? "text-emerald-500" : "text-muted-foreground")}>
              {prejuizo ? formatCurrency(row.grossProfit) : "sem imposto"}
            </p>
          )}
        </div>

        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t divide-y">
          {/* Memória de cálculo */}
          <div className="px-4 py-3 space-y-1.5 bg-muted/20">
            <Line label="Total vendido no mês" value={formatCurrency(row.totalSales)} />
            <Line
              label="Lucro apurado"
              value={formatCurrency(row.grossProfit)}
              valueClass={row.grossProfit >= 0 ? "text-foreground" : "text-emerald-500"}
            />
            {row.lossCarriedIn > 0 && (
              <Line label="Prejuízo compensado" value={`− ${formatCurrency(row.lossCarriedIn - row.lossCarriedOut)}`} valueClass="text-emerald-500" />
            )}
            {row.exempt ? (
              <p className="text-[11px] text-emerald-500 pt-1">
                Isento: vendas abaixo de {formatCurrency(EXEMPTION_LIMIT)} no mês.
              </p>
            ) : row.taxableProfit > 0 ? (
              <>
                <Line label="Base de cálculo" value={formatCurrency(row.taxableProfit)} />
                <Line label={`Alíquota (${(row.taxRate * 100).toFixed(0)}%)`} value={formatCurrency(row.taxDue)} valueClass="font-bold text-amber-500" />
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground pt-1">{meta.note}</p>
            )}
            {row.lossCarriedOut > 0 && (
              <Line label="Prejuízo que segue" value={formatCurrency(row.lossCarriedOut)} valueClass="text-emerald-500" />
            )}
          </div>

          {/* Vendas do mês */}
          <div className="divide-y">
            {row.sales.map((s, i) => (
              <div key={`${s.ticker}-${s.date}-${i}`} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{s.ticker}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(s.date + "T00:00:00"), "dd/MM")} · {s.quantity} un · custo méd. {formatCurrency(s.avgPrice)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(s.proceeds)}</p>
                  <p className={cn("text-[11px] tabular-nums font-medium", s.profit >= 0 ? "text-emerald-500" : "text-destructive")}>
                    {s.profit >= 0 ? "+" : ""}{formatCurrency(s.profit)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Line({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-semibold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
