"use client";

import type { Dispatch, SetStateAction } from "react";
import { Trash2, TrendingUp, Pencil, ChevronDown, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  SECTOR_COLORS, detectAssetType, detectSector, type AssetType,
} from "@/lib/stock-utils";
import type { StockTrade, PortfolioSnapshot } from "@/types/database";

type StockPosition = {
  ticker: string;
  quantity: number;
  totalInvested: number;
  avgPrice: number;
};

export type AcoesTabProps = {
  totalStocks: number;
  stockPositions: StockPosition[];
  stockTrades: StockTrade[];
  quoteMap: Map<string, number>;
  portfolioSnapshots: PortfolioSnapshot[];
  sectorData: { name: string; value: number; pct: number }[];
  selectedSector: string | null;
  setSelectedSector: Dispatch<SetStateAction<string | null>>;
  historyOpen: boolean;
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;
  bulkQuoteOpen: boolean;
  setBulkQuoteOpen: (v: boolean) => void;
  bulkPrices: Record<string, string>;
  setBulkPrices: Dispatch<SetStateAction<Record<string, string>>>;
  setQuoteForm: (v: { ticker: string; price: string }) => void;
  setQuoteOpen: (v: boolean) => void;
  handleBulkSaveQuotes: () => void;
  handleDeleteStock: (id: string) => void;
};

export function AcoesTab({
  totalStocks,
  stockPositions,
  stockTrades,
  quoteMap,
  portfolioSnapshots,
  sectorData,
  selectedSector,
  setSelectedSector,
  historyOpen,
  setHistoryOpen,
  bulkQuoteOpen,
  setBulkQuoteOpen,
  bulkPrices,
  setBulkPrices,
  setQuoteForm,
  setQuoteOpen,
  handleBulkSaveQuotes,
  handleDeleteStock,
}: AcoesTabProps) {
  return (
    <>
      {/* Summary flat row */}
      <div className="flex overflow-x-auto border-b divide-x">
        <div className="px-4 py-3 flex-1 min-w-[100px] shrink-0">
          <p className="text-xs text-muted-foreground">Total em ações</p>
          <p className="text-xl font-bold text-blue-600 tabular-nums">{formatCurrency(totalStocks)}</p>
        </div>
        <div className="px-4 py-3 flex-1 min-w-[80px] shrink-0">
          <p className="text-xs text-muted-foreground">Ativos</p>
          <p className="text-xl font-bold tabular-nums">{stockPositions.length}</p>
        </div>
        <div className="px-4 py-3 flex-1 min-w-[80px] shrink-0">
          <p className="text-xs text-muted-foreground">Operações</p>
          <p className="text-xl font-bold tabular-nums">{stockTrades.length}</p>
        </div>
      </div>

      {stockPositions.length > 0 && (
        <div className="border-b">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Posições atuais</p>
              <p className="text-xs text-muted-foreground">Clique no lápis para atualizar cotação individual</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => {
              const init: Record<string, string> = {};
              stockPositions.forEach((p) => { init[p.ticker] = quoteMap.has(p.ticker) ? String(quoteMap.get(p.ticker)) : ""; });
              setBulkPrices(init);
              setBulkQuoteOpen(true);
            }}>
              <TrendingUp className="h-3.5 w-3.5 mr-1" />Atualizar cotações
            </Button>
          </div>
          <div className="divide-y">
            {stockPositions.map((p) => {
              const curPrice = quoteMap.get(p.ticker);
              const curValue = curPrice !== undefined ? curPrice * p.quantity : undefined;
              const gain = curValue !== undefined ? curValue - p.totalInvested : undefined;
              const gainPct = gain !== undefined && p.totalInvested > 0 ? (gain / p.totalInvested) * 100 : undefined;
              const assetType = detectAssetType(p.ticker);
              const assetBadge: Record<AssetType, string> = {
                FII: "bg-purple-100 text-purple-800",
                ETF: "bg-yellow-100 text-yellow-800",
                BDR: "bg-orange-100 text-orange-800",
                Ação: "bg-blue-100 text-blue-800",
              };
              return (
                <div key={p.ticker} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold">{p.ticker}</p>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${assetBadge[assetType]}`}>{assetType}</span>
                      {gain !== undefined && (
                        <span className={`text-xs font-semibold ${gain >= 0 ? "text-green-600" : "text-destructive"}`}>
                          {gain >= 0 ? "+" : ""}{gainPct?.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.quantity} {assetType === "FII" ? "cotas" : assetType === "ETF" ? "cotas" : p.quantity === 1 ? "ação" : "ações"} · médio {formatCurrency(p.avgPrice)}
                      {curPrice !== undefined && ` · atual ${formatCurrency(curPrice)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {curValue !== undefined ? (
                      <>
                        <p className="font-semibold text-blue-600 tabular-nums">{formatCurrency(curValue)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          investido {formatCurrency(p.totalInvested)}
                        </p>
                      </>
                    ) : (
                      <p className="font-semibold text-blue-600 tabular-nums">{formatCurrency(p.totalInvested)}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Atualizar cotação"
                    onClick={() => { setQuoteForm({ ticker: p.ticker, price: curPrice ? String(curPrice) : "" }); setQuoteOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evolução do portfólio — flat section */}
      {portfolioSnapshots.length > 0 && (
        <div className="border-b">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Evolução do portfólio</p>
              <p className="text-xs text-muted-foreground">Valor total vs. investido · {portfolioSnapshots.length} snapshot{portfolioSnapshots.length !== 1 ? "s" : ""}</p>
            </div>
            {(() => {
              const last = portfolioSnapshots[portfolioSnapshots.length - 1];
              const first = portfolioSnapshots[0];
              const gain = last.total - first.total;
              const gainPct = first.total > 0 ? (gain / first.total) * 100 : 0;
              return (
                <div className="text-right">
                  <p className={`text-sm font-bold tabular-nums ${gain >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {gain >= 0 ? "+" : ""}{gainPct.toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground">{gain >= 0 ? "+" : ""}{formatCurrency(gain)} no período</p>
                </div>
              );
            })()}
          </div>
          <div className="px-4 py-4">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={portfolioSnapshots.map((s) => ({
                data: new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
                "Valor atual": s.total,
                "Investido": s.invested,
              }))}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradInvested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`} width={64} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const total = Number(payload.find((p) => p.dataKey === "Valor atual")?.value ?? 0);
                    const invested = Number(payload.find((p) => p.dataKey === "Investido")?.value ?? 0);
                    const diff = total - invested;
                    return (
                      <div className="bg-white dark:bg-zinc-900 border rounded-xl shadow-lg p-3.5 min-w-[200px] space-y-2">
                        <p className="text-xs font-bold border-b pb-2">{label}</p>
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Valor atual</span>
                          <span className="font-bold tabular-nums">{formatCurrency(total)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400 inline-block" />Investido</span>
                          <span className="font-bold tabular-nums">{formatCurrency(invested)}</span>
                        </div>
                        <div className={`flex justify-between text-sm font-semibold border-t pt-2 ${diff >= 0 ? "text-green-600" : "text-destructive"}`}>
                          <span>Ganho/perda</span>
                          <span className="tabular-nums">{diff >= 0 ? "+" : ""}{formatCurrency(diff)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend iconType="square" iconSize={10} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                <Area type="monotone" dataKey="Investido" stroke="#94a3b8" strokeWidth={1.5} fill="url(#gradInvested)" strokeDasharray="4 2" />
                <Area type="monotone" dataKey="Valor atual" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Dialog: atualizar cotações em lote */}
      <Dialog open={bulkQuoteOpen} onOpenChange={setBulkQuoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar cotações</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {stockPositions.map((p) => {
              const assetType = detectAssetType(p.ticker);
              const assetBadge: Record<AssetType, string> = {
                FII: "bg-purple-100 text-purple-800",
                ETF: "bg-yellow-100 text-yellow-800",
                BDR: "bg-orange-100 text-orange-800",
                Ação: "bg-blue-100 text-blue-800",
              };
              return (
                <div key={p.ticker} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-sm">{p.ticker}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${assetBadge[assetType]}`}>{assetType}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">médio {formatCurrency(p.avgPrice)} · {p.quantity} {assetType === "FII" || assetType === "ETF" ? "cotas" : "ações"}</p>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={`Ex: ${p.avgPrice.toFixed(2)}`}
                      value={bulkPrices[p.ticker] ?? ""}
                      onChange={(e) => setBulkPrices((prev) => ({ ...prev, [p.ticker]: e.target.value }))}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Ao salvar, um snapshot do portfólio será registrado automaticamente com a data de hoje.</p>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setBulkQuoteOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkSaveQuotes}>
              <TrendingUp className="h-4 w-4 mr-1.5" />Salvar e registrar snapshot
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {sectorData.length > 0 && (
        <div className="border-b">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Diversificação por setor</p>
              <p className="text-xs text-muted-foreground">Distribuição do valor atual da carteira</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(sectorData.reduce((s, d) => s + d.value, 0))}</p>
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Donut clicável */}
              <div className="relative shrink-0" style={{ width: 260, height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorData}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={108}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      style={{ cursor: "pointer" }}
                      onClick={(d) => setSelectedSector((prev) => prev === (d as {name: string}).name ? null : (d as {name: string}).name)}
                      label={(props) => {
                        const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as {
                          cx: number; cy: number; midAngle: number;
                          innerRadius: number; outerRadius: number; percent: number;
                        };
                        if (percent < 0.05) return null;
                        const RADIAN = Math.PI / 180;
                        const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + r * Math.cos(-midAngle * RADIAN);
                        const y = cy + r * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
                            fontSize={11} fontWeight="700">
                            {(percent * 100).toFixed(0)}%
                          </text>
                        );
                      }}
                    >
                      {sectorData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                          opacity={selectedSector && selectedSector !== entry.name ? 0.35 : 1}
                          stroke={selectedSector === entry.name ? "#1e293b" : "none"}
                          strokeWidth={selectedSector === entry.name ? 2 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-semibold">{d.name}</p>
                            <p className="text-muted-foreground">{formatCurrency(d.value)}</p>
                            <p className="font-bold text-base">{d.pct.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground mt-1">Clique para ver as ações</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xs text-muted-foreground">{sectorData.length} setores</p>
                  <p className="text-sm font-bold tabular-nums">
                    {formatCurrency(sectorData.reduce((s, d) => s + d.value, 0))}
                  </p>
                </div>
              </div>

              {/* Legenda + painel de detalhe */}
              <div className="flex-1 w-full space-y-2">
                {sectorData.map((s, i) => {
                  const color = SECTOR_COLORS[i % SECTOR_COLORS.length];
                  const isSelected = selectedSector === s.name;
                  // ações que compõem esse setor
                  const sectorStocks = stockPositions
                    .filter((p) => detectSector(p.ticker) === s.name)
                    .map((p) => {
                      const cur = quoteMap.get(p.ticker);
                      const curValue = cur !== undefined ? cur * p.quantity : p.totalInvested;
                      const gain = cur !== undefined ? curValue - p.totalInvested : undefined;
                      const gainPct = gain !== undefined && p.totalInvested > 0 ? (gain / p.totalInvested) * 100 : undefined;
                      const assetType = detectAssetType(p.ticker);
                      return { ...p, curValue, gain, gainPct, assetType };
                    });
                  return (
                    <div key={s.name}>
                      <div
                        className={`rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${isSelected ? "bg-muted/60" : "hover:bg-muted/30"}`}
                        onClick={() => setSelectedSector((prev) => prev === s.name ? null : s.name)}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0 mt-1.5"
                            style={{ backgroundColor: color }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium leading-snug break-words">{s.name}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {sectorStocks.length} ativo{sectorStocks.length !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                <span className="text-sm font-bold tabular-nums" style={{ color }}>
                                  {s.pct.toFixed(1)}%
                                </span>
                                <span className="text-sm font-semibold tabular-nums text-foreground w-[5.5rem] text-right">
                                  {formatCurrency(s.value)}
                                </span>
                                <ChevronDown
                                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isSelected ? "rotate-180" : ""}`}
                                />
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${s.pct}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Painel de ações do setor */}
                      {isSelected && (
                        <div className="mt-1 mb-2 ml-4 rounded-xl border bg-background shadow-sm overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                                <th className="text-left py-2 px-3 font-medium">Ticker</th>
                                <th className="text-right py-2 px-3 font-medium">Qtd</th>
                                <th className="text-right py-2 px-3 font-medium">Preço médio</th>
                                <th className="text-right py-2 px-3 font-medium">Cotação atual</th>
                                <th className="text-right py-2 px-3 font-medium">Valor</th>
                                <th className="text-right py-2 px-3 font-medium">Variação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sectorStocks.map((p) => {
                                const assetBadge: Record<AssetType, string> = {
                                  FII: "bg-purple-100 text-purple-800",
                                  ETF: "bg-yellow-100 text-yellow-800",
                                  BDR: "bg-orange-100 text-orange-800",
                                  Ação: "bg-blue-100 text-blue-800",
                                };
                                return (
                                  <tr key={p.ticker} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="py-2.5 px-3">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{p.ticker}</span>
                                        <span className={`text-xs px-1 py-0.5 rounded font-medium ${assetBadge[p.assetType]}`}>{p.assetType}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-right tabular-nums">
                                      {p.quantity} {p.assetType === "FII" || p.assetType === "ETF" ? "cotas" : p.quantity === 1 ? "ação" : "ações"}
                                    </td>
                                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{formatCurrency(p.avgPrice)}</td>
                                    <td className="py-2.5 px-3 text-right tabular-nums">
                                      {quoteMap.has(p.ticker) ? formatCurrency(quoteMap.get(p.ticker)!) : <span className="text-muted-foreground text-xs">sem cotação</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-blue-600">{formatCurrency(p.curValue)}</td>
                                    <td className="py-2.5 px-3 text-right tabular-nums">
                                      {p.gainPct !== undefined ? (
                                        <span className={`font-semibold ${p.gainPct >= 0 ? "text-green-600" : "text-destructive"}`}>
                                          {p.gainPct >= 0 ? "+" : ""}{p.gainPct.toFixed(2)}%
                                        </span>
                                      ) : <span className="text-muted-foreground text-xs">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t bg-muted/20">
                                <td className="py-2 px-3 text-xs text-muted-foreground font-semibold" colSpan={4}>Total do setor</td>
                                <td className="py-2 px-3 text-right tabular-nums font-bold text-blue-700">{formatCurrency(s.value)}</td>
                                <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color }}>
                                  {s.pct.toFixed(1)}% da carteira
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de operações — flat colapsável */}
      <div className="border-b">
        <div
          className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between cursor-pointer select-none"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <div>
            <p className="text-sm font-semibold">Histórico de operações</p>
            <p className="text-xs text-muted-foreground">{stockTrades.length} registro{stockTrades.length !== 1 ? "s" : ""}</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`} />
        </div>
        {historyOpen && (
          <>
            {stockTrades.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm px-4">
                Nenhuma operação registrada. Clique em &quot;Comprar ações&quot; para começar.
              </p>
            ) : (
              <div className="divide-y">
                {stockTrades.map((trade) => (
                  <div key={trade.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 mr-3">
                      <LineChart className="h-5 w-5 shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="font-bold text-sm">{trade.ticker}</p>
                        <p className="text-xs text-muted-foreground">
                          {trade.quantity} ações × {formatCurrency(trade.price_per_share)} · {formatDate(trade.date)}
                        </p>
                        {trade.notes && <p className="text-xs text-muted-foreground">{trade.notes}</p>}
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 shrink-0">Compra</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-semibold text-blue-600 tabular-nums">+{formatCurrency(trade.total_amount)}</p>
                      <Button variant="ghost" size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDeleteStock(trade.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
