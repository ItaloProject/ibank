"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Activity, RefreshCw, TrendingUp, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  type MarketRates, type RateCategory, CATEGORY_META,
  annualRate, toMonthly, formatPct,
} from "@/lib/investment-rates";

interface Props {
  balances: Partial<Record<RateCategory, number>>;
  userId: string;
}

// Produtos que permitem ajuste de % do CDI
type AdjustableCat = "poupanca" | "cdb" | "lci_lca";
const ADJUSTABLE: AdjustableCat[] = ["poupanca", "cdb", "lci_lca"];

const ORDER: RateCategory[] = ["poupanca", "selic", "cdb", "lci_lca"];

// Cor por produto Nubank
const CAT_COLOR: Record<RateCategory, string> = {
  poupanca: "#820ad1", // roxo Nubank
  selic:    "#3b82f6",
  cdb:      "#820ad1",
  lci_lca:  "#10b981",
};

export function InvestmentRates({ balances, userId }: Props) {
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [pctCdi, setPctCdi] = useState<Record<AdjustableCat, number>>({
    poupanca: CATEGORY_META.poupanca.defaultPctCdi,
    cdb: CATEGORY_META.cdb.defaultPctCdi,
    lci_lca: CATEGORY_META.lci_lca.defaultPctCdi,
  });

  const pctKey = `ibank_pctcdi_${userId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pctKey);
      if (raw) setPctCdi((p) => ({ ...p, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }, [pctKey]);

  async function loadRates() {
    setLoading(true);
    try {
      const res = await fetch("/api/market-rates");
      setRates(await res.json());
    } catch {
      setRates(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRates(); }, []);

  function updatePct(cat: AdjustableCat, value: string) {
    const v = Math.max(0, Math.min(300, parseFloat(value) || 0));
    const next = { ...pctCdi, [cat]: v };
    setPctCdi(next);
    localStorage.setItem(pctKey, JSON.stringify(next));
  }

  if (loading || !rates) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10 text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Buscando taxas no Banco Central...</span>
        </CardContent>
      </Card>
    );
  }

  const rows = ORDER.map((cat) => {
    const pct = ADJUSTABLE.includes(cat as AdjustableCat)
      ? pctCdi[cat as AdjustableCat]
      : undefined;
    const anual = annualRate(cat, rates, pct);
    const mensal = toMonthly(anual);
    const balance = balances[cat] ?? 0;
    const monthlyGain = balance * (mensal / 100);
    return { cat, anual, mensal, balance, monthlyGain, pct };
  });

  const totalMonthlyGain = rows.reduce((s, r) => s + r.monthlyGain, 0);
  const bestMonthly = Math.max(...rows.map((r) => r.mensal));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Rentabilidade estimada · Nubank
            </CardTitle>
            <CardDescription className="mt-1">
              Projeção de lucro mensal por produto com taxas oficiais em tempo real
            </CardDescription>
          </div>
          <button
            onClick={loadRates}
            title="Atualizar taxas"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Taxas ao vivo */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="gap-1.5 font-normal">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Selic <strong>{formatPct(rates.selicAnual)}</strong> a.a.
          </Badge>
          <Badge variant="secondary" className="gap-1.5 font-normal">
            CDI <strong>{formatPct(rates.cdiAnual)}</strong> a.a.
          </Badge>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {rates.source === "bcb" ? `Banco Central · ${rates.updatedAt}` : "Estimativa offline"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Cards por produto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((r) => {
            const meta = CATEGORY_META[r.cat];
            const isBest = r.mensal === bestMonthly;
            const color = CAT_COLOR[r.cat];
            const isAdjustable = ADJUSTABLE.includes(r.cat as AdjustableCat);

            return (
              <div
                key={r.cat}
                className="rounded-xl border p-4 space-y-3 relative overflow-hidden"
                style={{ borderColor: `${color}30`, background: `linear-gradient(135deg, ${color}08 0%, transparent 100%)` }}
              >
                {/* Stripe lateral */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: color }} />

                <div className="pl-2">
                  {/* Header do card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm">{meta.label}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{meta.nubank}</span>
                        {isBest && (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 py-0 gap-0.5">
                            <TrendingUp className="h-2.5 w-2.5" /> melhor
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{meta.description}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] px-1.5 py-0 font-normal ${meta.isento ? "text-green-600 border-green-200" : "text-amber-600 border-amber-200"}`}
                    >
                      {meta.isento ? "isento IR" : "IR regressivo"}
                    </Badge>
                  </div>

                  {/* Taxas */}
                  <div className="flex items-end justify-between mt-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">a.a.</span>
                        <span className="text-sm font-semibold tabular-nums">{formatPct(r.anual)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">a.m.</span>
                        <span className="text-base font-bold tabular-nums" style={{ color }}>{formatPct(r.mensal, 3)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {r.balance > 0 ? (
                        <>
                          <p className="text-base font-bold text-green-600 tabular-nums">+{formatCurrency(r.monthlyGain)}</p>
                          <p className="text-[10px] text-muted-foreground">sobre {formatCurrency(r.balance)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">sem saldo</p>
                      )}
                    </div>
                  </div>

                  {/* Ajuste % CDI */}
                  {isAdjustable && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed" style={{ borderColor: `${color}30` }}>
                      <span className="text-[11px] text-muted-foreground flex-1">% do CDI contratado</span>
                      <Input
                        type="number"
                        value={pctCdi[r.cat as AdjustableCat]}
                        onChange={(e) => updatePct(r.cat as AdjustableCat, e.target.value)}
                        className="h-6 w-14 text-xs text-right px-2"
                      />
                      <span className="text-[11px] text-muted-foreground">%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total projetado */}
        {totalMonthlyGain > 0 && (
          <div className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "linear-gradient(135deg, #820ad115 0%, #820ad108 100%)", border: "1px solid #820ad130" }}>
            <div>
              <p className="text-sm font-medium">Lucro mensal estimado</p>
              <p className="text-xs text-muted-foreground">soma de todos os produtos</p>
            </div>
            <span className="text-xl font-bold text-green-600 tabular-nums">+{formatCurrency(totalMonthlyGain)}</span>
          </div>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          NuConta e CDB Nubank rendem 100% do CDI. Tesouro Selic segue a meta Selic.
          LCI/LCA são produtos de parceiros via NuInvest, geralmente isentos de IR.
          Ajuste o % do CDI conforme o produto contratado.
        </p>
      </CardContent>
    </Card>
  );
}
