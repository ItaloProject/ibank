"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { getPortfolioSnapshots } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import type { PortfolioSnapshot } from "@/types/database";
import { computePerformance, filterByMonths, type CdiPoint } from "@/lib/performance";
import { useTheme } from "@/components/theme-provider";
import { LineChart as LineChartIcon, Loader2, TrendingUp, TrendingDown, Info, Camera } from "lucide-react";
import { format } from "date-fns";

const PERIODS: { label: string; months: number | null }[] = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "Tudo", months: null },
];

function fmtPct(v: number, digits = 2) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits).replace(".", ",")}%`;
}

export default function RentabilidadePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const axisColor = isDark ? "#94a3b8" : "#6b7280";
  const gridColor = isDark ? "#1e293b" : "#e5e7eb";
  const tooltipBg = isDark ? "#0f172a" : "#ffffff";
  const tooltipBorder = isDark ? "#1e293b" : "#e5e7eb";
  const tooltipText = isDark ? "#f1f5f9" : "#111827";

  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [cdi, setCdi] = useState<CdiPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<number | null>(null);

  useEffect(() => {
    getPortfolioSnapshots()
      .then(async (s) => {
        const list = Array.isArray(s) ? (s as PortfolioSnapshot[]) : [];
        setSnapshots(list);
        if (list.length >= 2) {
          const start = [...list].sort((a, b) => a.date.localeCompare(b.date))[0].date;
          try {
            const res = await fetch(`/api/cdi-series?start=${start}`);
            const data = await res.json();
            if (Array.isArray(data.series)) setCdi(data.series);
          } catch { /* sem CDI a página ainda mostra a carteira */ }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const perf = useMemo(
    () => computePerformance(filterByMonths(snapshots, months), cdi),
    [snapshots, months, cdi],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const bateuCdi = perf && perf.cdiReturn !== null && perf.twr > perf.cdiReturn;

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <LineChartIcon className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">Rentabilidade</h1>
            <p className="text-xs text-muted-foreground">Sua carteira comparada ao CDI</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {!perf ? (
          <div className="rounded-2xl border bg-card py-14 text-center px-6">
            <Camera className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium">Ainda não dá para medir rentabilidade</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
              É preciso ao menos dois registros de patrimônio em datas diferentes.
              Em <strong className="text-foreground">Investimentos</strong>, atualize as cotações da
              carteira — cada atualização grava um ponto no histórico.
            </p>
            {snapshots.length === 1 && (
              <p className="text-[11px] text-muted-foreground mt-3">
                Você tem 1 registro ({format(new Date(snapshots[0].date + "T00:00:00"), "dd/MM/yyyy")}). Falta mais um.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Período */}
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setMonths(p.months)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors",
                    months === p.months ? "bg-foreground text-background" : "border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Destaque */}
            <div className="rounded-2xl border bg-card px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Rentabilidade no período</p>
                  <p className={cn(
                    "text-3xl font-bold tabular-nums mt-1",
                    perf.twr >= 0 ? "text-emerald-500" : "text-destructive",
                  )}>
                    {fmtPct(perf.twr)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {format(new Date(perf.firstDate + "T00:00:00"), "dd/MM/yy")}
                    {" — "}
                    {format(new Date(perf.lastDate + "T00:00:00"), "dd/MM/yy")}
                  </p>
                </div>
                {perf.cdiReturn !== null && (
                  <div className={cn(
                    "rounded-xl px-3 py-2 text-right shrink-0",
                    bateuCdi ? "bg-emerald-500/10" : "bg-amber-500/10",
                  )}>
                    <div className="flex items-center gap-1.5 justify-end">
                      {bateuCdi
                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        : <TrendingDown className="h-3.5 w-3.5 text-amber-500" />}
                      <span className={cn("text-xs font-bold", bateuCdi ? "text-emerald-500" : "text-amber-500")}>
                        {bateuCdi ? "Acima do CDI" : "Abaixo do CDI"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      CDI: {fmtPct(perf.cdiReturn)}
                    </p>
                    {perf.pctOfCdi !== null && (
                      <p className="text-[11px] font-semibold mt-0.5">
                        {perf.pctOfCdi.toFixed(0)}% do CDI
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Números absolutos */}
              <div className="grid grid-cols-3 divide-x border-t mt-4 pt-4 -mx-5 px-5">
                <div className="pr-3">
                  <p className="text-[11px] text-muted-foreground">Aportado</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5">{formatCurrency(perf.currentInvested)}</p>
                </div>
                <div className="px-3">
                  <p className="text-[11px] text-muted-foreground">Valor atual</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5">{formatCurrency(perf.currentTotal)}</p>
                </div>
                <div className="pl-3">
                  <p className="text-[11px] text-muted-foreground">Lucro</p>
                  <p className={cn(
                    "text-sm font-bold tabular-nums mt-0.5",
                    perf.nominalGain >= 0 ? "text-emerald-500" : "text-destructive",
                  )}>
                    {formatCurrency(perf.nominalGain)}
                  </p>
                </div>
              </div>
            </div>

            {/* Gráfico */}
            <div className="rounded-2xl border bg-card px-2 sm:px-4 py-4">
              <p className="text-xs font-semibold px-2 mb-3">Carteira vs CDI <span className="text-muted-foreground font-normal">(base 100)</span></p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={perf.series} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: axisColor, fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: gridColor }}
                    tickFormatter={(d) => format(new Date(d + "T00:00:00"), "dd/MM")}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: axisColor, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => Number(v).toFixed(0)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: tooltipBg, border: `1px solid ${tooltipBorder}`,
                      borderRadius: 8, color: tooltipText, fontSize: 12,
                    }}
                    labelFormatter={(d) => format(new Date(String(d) + "T00:00:00"), "dd/MM/yyyy")}
                    formatter={(v, name) => [
                      typeof v === "number" ? `${(v - 100).toFixed(2).replace(".", ",")}%` : String(v),
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="line" />
                  <Line
                    type="monotone" dataKey="carteira" name="Carteira"
                    stroke="#10b981" strokeWidth={2} dot={false}
                  />
                  {perf.cdiReturn !== null && (
                    <Line
                      type="monotone" dataKey="cdi" name="CDI"
                      stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Metodologia */}
            <div className="rounded-2xl border bg-muted/30 px-4 py-3.5 flex gap-2.5">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1">
                <p>
                  Rentabilidade calculada por <strong className="text-foreground">TWR</strong> (Modified Dietz),
                  que desconta o efeito dos aportes — dinheiro novo entrando não conta como lucro.
                </p>
                <p>
                  {cdi.length > 0
                    ? "CDI acumulado com a série diária oficial do Banco Central."
                    : "Série do CDI indisponível no momento — apenas a carteira é exibida."}
                  {" "}Considera a carteira de ações/FIIs registrada; renda fixa não entra no histórico de patrimônio.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
