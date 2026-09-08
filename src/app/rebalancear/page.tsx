"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "@/context/user-context";
import { getInvestmentAccounts, getStockTrades, getStockQuotes } from "@/lib/api";
import type { InvestmentAccount, StockTrade } from "@/types/database";
import type { StockQuote } from "@/lib/api";
import { computeStockPositions, detectAssetType } from "@/lib/stock-utils";
import {
  computeRebalance, PROFILE_TARGETS, DEFAULT_TARGET,
  type AssetClass, type RebalanceResult,
} from "@/lib/rebalance";
import { formatCurrency, cn } from "@/lib/utils";
import { Scale, Loader2, Info, AlertTriangle, CheckCircle2, ArrowRight, Wallet } from "lucide-react";

const QUICK = [500, 1000, 2000, 5000];

export default function RebalancearPage() {
  const { investmentProfile } = useUser();
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [trades, setTrades] = useState<StockTrade[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [aporte, setAporte] = useState(1000);

  useEffect(() => {
    Promise.all([getInvestmentAccounts(), getStockTrades(), getStockQuotes()])
      .then(([a, t, q]) => {
        setAccounts(Array.isArray(a) ? (a as InvestmentAccount[]) : []);
        setTrades(Array.isArray(t) ? (t as StockTrade[]) : []);
        setQuotes(Array.isArray(q) ? (q as StockQuote[]) : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const target = (investmentProfile && PROFILE_TARGETS[investmentProfile]) || DEFAULT_TARGET;

  const current = useMemo<Record<AssetClass, number>>(() => {
    const quoteMap = new Map(quotes.map((q) => [q.ticker, q.current_price]));
    const positions = computeStockPositions(trades);

    let acoes = 0;
    let fii = 0;
    for (const p of positions) {
      const price = quoteMap.get(p.ticker);
      // Sem cotação, usa o custo — evita zerar a posição no cálculo
      const value = price !== undefined ? price * p.quantity : p.totalInvested;
      if (detectAssetType(p.ticker) === "FII") fii += value;
      else acoes += value;
    }

    const renda_fixa = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
    return { renda_fixa, acoes, fii };
  }, [accounts, trades, quotes]);

  const result: RebalanceResult = useMemo(
    () => computeRebalance(current, target, aporte),
    [current, target, aporte],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const semCarteira = result.total <= 0;
  const equilibrada = result.maxDrift < 2;

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Scale className="h-5 w-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">Rebalancear</h1>
            <p className="text-xs text-muted-foreground">
              Onde aplicar o próximo aporte
              {investmentProfile && (
                <> · perfil {investmentProfile === "aposentadoria" ? "Aposentadoria" : "Renda Mensal"}</>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {semCarteira ? (
          <div className="rounded-2xl border bg-card py-14 text-center px-6">
            <Wallet className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium">Carteira vazia</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Cadastre suas contas de renda fixa e ativos em <strong className="text-foreground">Investimentos</strong> para
              calcular o rebalanceamento.
            </p>
          </div>
        ) : (
          <>
            {/* Status do desvio */}
            <div className={cn(
              "rounded-2xl border px-4 py-3.5 flex items-center gap-3",
              equilibrada ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5",
            )}>
              {equilibrada
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {equilibrada ? "Carteira equilibrada" : `Desvio de ${result.maxDrift.toFixed(1)} p.p. do alvo`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Patrimônio atual {formatCurrency(result.total)}
                </p>
              </div>
            </div>

            {/* Aporte */}
            <div className="rounded-2xl border bg-card px-4 py-4 space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Quanto vai aportar
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={aporte || ""}
                  placeholder="0"
                  onChange={(e) => setAporte(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="w-full border rounded-xl pl-9 pr-4 py-3 text-base font-semibold bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {QUICK.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAporte(v)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                      aporte === v ? "bg-foreground text-background" : "border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {formatCurrency(v)}
                  </button>
                ))}
              </div>
            </div>

            {/* Plano de compra */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {aporte > 0 ? "Plano de compra" : "Distribuição atual"}
                </p>
              </div>
              <div className="divide-y">
                {result.rows.map((r) => (
                  <div key={r.cls} className="px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-sm font-semibold">{r.label}</span>
                        {r.overweight && (
                          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 shrink-0">
                            acima
                          </span>
                        )}
                      </div>
                      {aporte > 0 && (
                        <span className={cn(
                          "text-sm font-bold tabular-nums shrink-0",
                          r.buy > 0 ? "text-foreground" : "text-muted-foreground/50",
                        )}>
                          {r.buy > 0 ? formatCurrency(r.buy) : "—"}
                        </span>
                      )}
                    </div>

                    {/* Barra: atual -> depois, com marca do alvo */}
                    <div className="relative h-2 rounded-full bg-muted overflow-hidden mb-1.5">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full opacity-40 transition-all"
                        style={{ width: `${Math.min(r.afterPct, 100)}%`, backgroundColor: r.color }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{ width: `${Math.min(r.currentPct, 100)}%`, backgroundColor: r.color }}
                      />
                      <div
                        className="absolute inset-y-0 w-0.5 bg-foreground/40"
                        style={{ left: `${Math.min(r.targetPct, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="tabular-nums">
                        {r.currentPct.toFixed(1)}%
                        {aporte > 0 && r.afterPct.toFixed(1) !== r.currentPct.toFixed(1) && (
                          <>
                            {" "}<ArrowRight className="h-2.5 w-2.5 inline -mt-px" />{" "}
                            <span className="font-semibold text-foreground">{r.afterPct.toFixed(1)}%</span>
                          </>
                        )}
                        <span className="text-muted-foreground/60"> · alvo {r.targetPct}%</span>
                      </span>
                      <span className="tabular-nums">{formatCurrency(r.current)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {aporte > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                  <span className="text-sm font-semibold">Total do aporte</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(aporte)}</span>
                </div>
              )}
            </div>

            {/* Aviso de venda */}
            {result.needsSelling && aporte > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3.5 flex gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  <p className="text-foreground font-semibold text-xs mb-0.5">O aporte sozinho não fecha o desvio</p>
                  <p>
                    Alguma classe segue acima do alvo mesmo depois de comprar. Dá para continuar aportando
                    nas defasadas ao longo dos próximos meses, ou vender o excedente — lembrando que a venda
                    gera ganho de capital tributável (veja em <strong className="text-foreground">Imposto de Renda</strong>).
                  </p>
                </div>
              </div>
            )}

            {/* Metodologia */}
            <div className="rounded-2xl border bg-muted/30 px-4 py-3.5 flex gap-2.5">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1">
                <p>
                  O plano direciona o aporte para as classes abaixo do alvo, priorizando as mais defasadas.
                  Rebalancear comprando evita corretagem e imposto sobre ganho de capital.
                </p>
                <p>
                  Alvo definido pelo seu perfil de investimento, ajustável em <strong className="text-foreground">Configurações</strong>.
                  Sugestão de alocação por classe — a escolha dos ativos é sua.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
