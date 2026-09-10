"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "@/context/user-context";
import { getInvestmentAccounts, getStockTrades, getStockQuotes } from "@/lib/api";
import type { InvestmentAccount, StockTrade } from "@/types/database";
import type { StockQuote } from "@/lib/api";
import { computeStockPositions, detectAssetType } from "@/lib/stock-utils";
import {
  computeRebalance, PROFILE_TARGETS, DEFAULT_TARGET, CLASS_META,
  type AssetClass, type RebalanceResult,
} from "@/lib/rebalance";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Loader2, Info, AlertTriangle, CheckCircle2, ArrowRight, Wallet,
  SlidersHorizontal, X, Check, RotateCcw,
} from "lucide-react";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

const QUICK = [500, 1000, 2000, 5000];

/** Ativos que o usuário já possui, por classe, com preço atual. */
interface HeldAsset { ticker: string; price: number; cls: AssetClass }

export default function RebalancearPage() {
  const { investmentProfile } = useUser();
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [trades, setTrades] = useState<StockTrade[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [aporte, setAporte] = useState(1000);

  // Alocação-alvo personalizada (null = usa o preset do perfil)
  const [customTarget, setCustomTarget] = useState<Record<AssetClass, number> | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    Promise.all([getInvestmentAccounts(), getStockTrades(), getStockQuotes()])
      .then(([a, t, q]) => {
        setAccounts(Array.isArray(a) ? (a as InvestmentAccount[]) : []);
        setTrades(Array.isArray(t) ? (t as StockTrade[]) : []);
        setQuotes(Array.isArray(q) ? (q as StockQuote[]) : []);
      })
      .finally(() => setLoading(false));

    fetch("/api/allocation-target")
      .then((r) => r.json())
      .then((d) => {
        if (d?.custom) setCustomTarget({ renda_fixa: d.renda_fixa, acoes: d.acoes, fii: d.fii });
      })
      .catch(() => { /* sem alvo salvo, segue com o preset */ });
  }, []);

  const presetTarget = (investmentProfile && PROFILE_TARGETS[investmentProfile]) || DEFAULT_TARGET;
  const target = customTarget ?? presetTarget;

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

  // Ativos com cotação conhecida, para converter reais em quantidade aproximada
  const held = useMemo<HeldAsset[]>(() => {
    const quoteMap = new Map(quotes.map((q) => [q.ticker, q.current_price]));
    return computeStockPositions(trades)
      .map((p) => {
        const price = quoteMap.get(p.ticker);
        if (!price || price <= 0) return null;
        return {
          ticker: p.ticker,
          price,
          cls: (detectAssetType(p.ticker) === "FII" ? "fii" : "acoes") as AssetClass,
        };
      })
      .filter((x): x is HeldAsset => x !== null)
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [trades, quotes]);

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
    <PageShell>
      <PageHeader
        title="Rebalancear"
        description={
          <>
            Onde aplicar o próximo aporte
            {customTarget
              ? " · alvo personalizado"
              : investmentProfile
                ? ` · perfil ${investmentProfile === "aposentadoria" ? "Aposentadoria" : "Renda Mensal"}`
                : ""}
          </>
        }
        actions={
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Definir alvo</span>
          </button>
        }
      />

      <PageBody width="medium">
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

                    {/* Equivalência em cotas dos ativos que já possui */}
                    {r.buy > 0 && (() => {
                      const opts = held.filter((h) => h.cls === r.cls);
                      if (opts.length === 0) return null;
                      return (
                        <div className="mt-2.5 pt-2.5 border-t border-dashed">
                          <p className="text-[10px] text-muted-foreground/70 mb-1.5">
                            {formatCurrency(r.buy)} equivale a, nos seus ativos:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {opts.map((h) => (
                              <span key={h.ticker} className="text-[10px] bg-muted rounded px-1.5 py-0.5 tabular-nums">
                                <strong className="text-foreground">{Math.floor(r.buy / h.price)}</strong>
                                <span className="text-muted-foreground"> × {h.ticker}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
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
                  {customTarget
                    ? "Alvo personalizado por você — toque em “Definir alvo” para ajustar."
                    : "Alvo vindo do seu perfil de investimento — toque em “Definir alvo” para usar a sua própria política."}
                  {" "}A quantidade em cotas é só a conversão do valor pelo preço de hoje: a escolha
                  de qual ativo comprar é sua.
                </p>
              </div>
            </div>
          </>
        )}
      </PageBody>

      {editOpen && (
        <TargetEditor
          initial={target}
          isCustom={customTarget !== null}
          presetLabel={investmentProfile === "renda_mensal" ? "Renda Mensal" : "Aposentadoria"}
          onClose={() => setEditOpen(false)}
          onSaved={(t) => { setCustomTarget(t); setEditOpen(false); }}
          onReset={() => { setCustomTarget(null); setEditOpen(false); }}
        />
      )}
    </PageShell>
  );
}

function TargetEditor({
  initial, isCustom, presetLabel, onClose, onSaved, onReset,
}: {
  initial: Record<AssetClass, number>;
  isCustom: boolean;
  presetLabel: string;
  onClose: () => void;
  onSaved: (t: Record<AssetClass, number>) => void;
  onReset: () => void;
}) {
  const [vals, setVals] = useState<Record<AssetClass, number>>({ ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const soma = vals.renda_fixa + vals.acoes + vals.fii;
  const valido = soma === 100;

  function set(cls: AssetClass, v: number) {
    setVals((p) => ({ ...p, [cls]: Math.min(100, Math.max(0, Math.round(v) || 0)) }));
    setError("");
  }

  async function salvar() {
    if (!valido) return;
    setSaving(true); setError("");
    const res = await fetch("/api/allocation-target", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vals),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data?.error ?? "Erro ao salvar"); return; }
    onSaved(vals);
  }

  async function restaurar() {
    setSaving(true);
    await fetch("/api/allocation-target", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    setSaving(false);
    onReset();
  }

  const ordem: AssetClass[] = ["acoes", "fii", "renda_fixa"];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm bg-background border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-blue-500" />
            <h2 className="font-bold text-sm">Alocação-alvo</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Defina a política da sua carteira. O plano de aporte passa a mirar estes percentuais.
          </p>

          {ordem.map((cls) => (
            <div key={cls} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CLASS_META[cls].color }} />
                  {CLASS_META[cls].label}
                </span>
                <span className="text-xs font-bold tabular-nums">{vals[cls]}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={vals[cls]}
                onChange={(e) => set(cls, Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          ))}

          {/* Somatório */}
          <div className={cn(
            "flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold",
            valido ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500",
          )}>
            <span>Soma</span>
            <span className="tabular-nums flex items-center gap-1.5">
              {valido && <Check className="h-3.5 w-3.5" />}
              {soma}%
              {!valido && (soma < 100 ? ` — faltam ${100 - soma}%` : ` — sobram ${soma - 100}%`)}
            </span>
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</p>}

          {isCustom && (
            <button
              onClick={restaurar}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Voltar ao preset do perfil {presetLabel}
            </button>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-all">
            Cancelar
          </button>
          <button onClick={salvar} disabled={!valido || saving}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar alvo"}
          </button>
        </div>
      </div>
    </div>
  );
}
