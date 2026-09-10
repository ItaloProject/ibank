"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2, AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Legend,
} from "recharts";
import { createInvestment, updateAccountBalance } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvestmentAccount, Investment, TurboRecord } from "@/types/database";
import { format } from "date-fns";
import { TYPE_CONFIG } from "./constants";

type TurboMonthForm = { month: string; total_bruto: string; rendimento: string; valor_liquido: string };
type RendMonthForm = { month: string; amount: string; description: string };
type RenameForm = {
  id: string; name: string; institution: string;
  is_turbo: boolean; cdi_percent: string; max_rendimento: string; valor_bruto: string; valor_liquido: string;
};

export type AccountTabProps = {
  account: InvestmentAccount;
  activeTab: string;
  accountInvestments: Investment[];
  computedBalance: number;
  chartData: { date: string; saldo: number }[];
  turboHistory: TurboRecord[];
  selectedTurboMonth: string | null;
  setSelectedTurboMonth: Dispatch<SetStateAction<string | null>>;
  turboMonthOpen: boolean;
  setTurboMonthOpen: (v: boolean) => void;
  turboMonthForm: TurboMonthForm;
  setTurboMonthForm: (v: TurboMonthForm) => void;
  rendMonthOpen: boolean;
  setRendMonthOpen: (v: boolean) => void;
  rendMonthForm: RendMonthForm;
  setRendMonthForm: (v: RendMonthForm) => void;
  setRenameForm: (v: RenameForm) => void;
  setRenameOpen: (v: boolean) => void;
  handleDeleteAccount: (id: string) => void;
  handleDeleteTurboRecord: (id: string) => void;
  handleSaveTurboMonth: () => void;
  handleDeleteInvestment: (inv: Investment) => void;
  load: () => void;
};

export function AccountTab({
  account,
  activeTab,
  accountInvestments,
  computedBalance,
  chartData,
  turboHistory,
  selectedTurboMonth,
  setSelectedTurboMonth,
  turboMonthOpen,
  setTurboMonthOpen,
  turboMonthForm,
  setTurboMonthForm,
  rendMonthOpen,
  setRendMonthOpen,
  rendMonthForm,
  setRendMonthForm,
  setRenameForm,
  setRenameOpen,
  handleDeleteAccount,
  handleDeleteTurboRecord,
  handleSaveTurboMonth,
  handleDeleteInvestment,
  load,
}: AccountTabProps) {
  return (
    <>
        {activeTab === account.id && (
          <>
            {/* Account header with rename + delete */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">{account.name}</h2>
                {account.institution && <p className="text-sm text-muted-foreground">{account.institution}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5"
                  onClick={() => {
                    setRenameForm({
                      id: account.id, name: account.name, institution: account.institution ?? "",
                      is_turbo: account.is_turbo ?? false,
                      cdi_percent: account.cdi_percent ? String(account.cdi_percent) : "",
                      max_rendimento: account.max_rendimento ? String(account.max_rendimento) : "",
                      valor_bruto: account.current_balance ? String(account.current_balance) : "",
                      valor_liquido: account.valor_liquido ? String(account.valor_liquido) : "",
                    });
                    setRenameOpen(true);
                  }}>
                  <Pencil className="h-3.5 w-3.5" /> Renomear
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir conta
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Excluir conta</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      Isso vai excluir a conta <strong>{account.name}</strong> e todos os seus{" "}
                      <strong>{accountInvestments.length} movimentos</strong> permanentemente. Ação irreversível.
                    </p>
                    <div className="flex gap-2 justify-end mt-2">
                      <Button variant="outline" onClick={() => {}}>Cancelar</Button>
                      <Button variant="destructive" onClick={() => handleDeleteAccount(account.id)}>Excluir tudo</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {account.is_turbo && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                  ⚡ TURBO
                </span>
                {account.cdi_percent && (
                  <span className="text-xs text-muted-foreground">{account.cdi_percent}% CDI</span>
                )}
                {account.max_rendimento && (
                  <span className="text-xs text-muted-foreground">· teto {formatCurrency(account.max_rendimento)}</span>
                )}
              </div>
            )}
            {account.is_turbo && account.max_rendimento && account.current_balance >= account.max_rendimento * 0.95 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    {account.name} está no teto — {formatCurrency(account.current_balance)} / {formatCurrency(account.max_rendimento)}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5">
                    O rendimento extra para de contar quando atinge o teto. Direcione novos aportes para FIIs ou ações.
                  </p>
                </div>
              </div>
            )}
            {account.is_turbo ? (
              /* ── Cards TURBO modernos ── */
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total bruto */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-md">
                  <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                  <div className="absolute -right-1 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100 mb-2">Total bruto</p>
                  <p className="text-2xl font-extrabold tabular-nums leading-none">{formatCurrency(account.current_balance)}</p>
                  <p className="text-xs text-emerald-200 mt-1.5">{account.institution}</p>
                </div>
                {/* Valor líquido */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-md">
                  <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                  <div className="absolute -right-1 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-100 mb-2">Valor líquido</p>
                  <p className="text-2xl font-extrabold tabular-nums leading-none">
                    {account.valor_liquido != null ? formatCurrency(account.valor_liquido) : "—"}
                  </p>
                  {account.valor_liquido != null && account.current_balance > 0 && (
                    <p className="text-xs text-blue-200 mt-1.5">IOF/IR est. {formatCurrency(account.current_balance - account.valor_liquido)}</p>
                  )}
                </div>
                {/* Líquido real */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 p-4 text-white shadow-md">
                  <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                  <div className="absolute -right-1 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-100 mb-2">Líquido real</p>
                  <p className="text-2xl font-extrabold tabular-nums leading-none">
                    {account.valor_liquido != null ? formatCurrency(account.valor_liquido - 5000) : "—"}
                  </p>
                  <p className="text-xs text-violet-200 mt-1.5">Líquido − R$ 5.000,00</p>
                </div>
                {/* Total de rendimentos */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-4 text-white shadow-md">
                  <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                  <div className="absolute -right-1 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-100 mb-2">Rendimentos</p>
                  <p className="text-2xl font-extrabold tabular-nums leading-none">
                    +{formatCurrency(turboHistory.reduce((s, r) => s + r.rendimento, 0))}
                  </p>
                  <p className="text-xs text-amber-100 mt-1.5">
                    {turboHistory.length} {turboHistory.length === 1 ? "mês registrado" : "meses registrados"}
                  </p>
                </div>
              </div>
            ) : (
              /* ── Cards conta normal → flat divide-x ── */
              <div className="grid grid-cols-3 border-y divide-x">
                <div className="px-2.5 sm:px-4 py-3 min-w-0 flex flex-col gap-1">
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight min-h-[2.5rem] flex items-end">
                    Saldo atual
                  </p>
                  <p className="text-sm sm:text-xl font-bold text-green-600 tabular-nums leading-tight truncate">
                    {formatCurrency(computedBalance)}
                  </p>
                  {account.valor_liquido != null ? (
                    <p className="text-[10px] sm:text-xs font-semibold text-blue-600 tabular-nums truncate">
                      {formatCurrency(account.valor_liquido)}{" "}
                      <span className="font-normal text-muted-foreground">líq.</span>
                    </p>
                  ) : (
                    <p className="text-[10px] sm:text-xs invisible select-none" aria-hidden>
                      —
                    </p>
                  )}
                </div>
                <div className="px-2.5 sm:px-4 py-3 min-w-0 flex flex-col gap-1">
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight min-h-[2.5rem] flex items-end">
                    <span className="sm:hidden">Depositado</span>
                    <span className="hidden sm:inline">Total depositado</span>
                  </p>
                  <p className="text-sm sm:text-xl font-bold tabular-nums leading-tight truncate">
                    {formatCurrency(
                      accountInvestments
                        .filter((i) => i.type === "deposito")
                        .reduce((s, i) => s + i.amount, 0)
                    )}
                  </p>
                  <p className="text-[10px] sm:text-xs invisible select-none" aria-hidden>
                    —
                  </p>
                </div>
                <div className="px-2.5 sm:px-4 py-3 min-w-0 flex flex-col gap-1">
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight min-h-[2.5rem] flex items-end">
                    <span className="sm:hidden">Rendimentos</span>
                    <span className="hidden sm:inline">Total de rendimentos</span>
                  </p>
                  <p className="text-sm sm:text-xl font-bold text-blue-600 tabular-nums leading-tight truncate">
                    {formatCurrency(
                      accountInvestments
                        .filter((i) => i.type === "rendimento")
                        .reduce((s, i) => s + i.amount, 0)
                    )}
                  </p>
                  <p className="text-[10px] sm:text-xs invisible select-none" aria-hidden>
                    —
                  </p>
                </div>
              </div>
            )}

            {/* ── TURBO: histórico mensal ── */}
            {account.is_turbo && (
              <>
                <div className="border-t">
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Evolução mensal TURBO</p>
                      <p className="text-xs text-muted-foreground">Bruto, rendimento e líquido por mês</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => {
                      setTurboMonthForm({ month: format(new Date(), "yyyy-MM"), total_bruto: "", rendimento: "", valor_liquido: "" });
                      setTurboMonthOpen(true);
                    }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Registrar mês
                    </Button>
                  </div>
                  <div className="px-4 space-y-6 py-4">
                    {turboHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum mês registrado ainda. Clique em &quot;Registrar mês&quot; para começar.
                      </p>
                    ) : (() => {
                      const chartData = turboHistory.map((r) => ({
                        id: r.id,
                        mes: r.month,
                        label: new Date(r.month + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
                        "Total bruto": r.total_bruto,
                        Rendimento: r.rendimento,
                        Líquido: r.valor_liquido ?? 0,
                      }));
                      const selected = selectedTurboMonth
                        ? turboHistory.find((r) => r.month === selectedTurboMonth) ?? null
                        : null;
                      const prevRecord = selected
                        ? turboHistory[turboHistory.findIndex((r) => r.month === selected.month) - 1] ?? null
                        : null;
                      return (
                        <>
                          {/* Gráfico de barras agrupadas */}
                          <div className="relative">
                            <p className="text-xs text-muted-foreground mb-2">Clique em um mês para ver detalhes</p>
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart
                                data={chartData}
                                barCategoryGap="30%"
                                barGap={3}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onClick={(e: any) => {
                                  if (e?.activePayload?.[0]) {
                                    const mes = e.activePayload[0].payload.mes as string;
                                    setSelectedTurboMonth((prev) => prev === mes ? null : mes);
                                  }
                                }}
                                style={{ cursor: "pointer" }}
                              >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis
                                  tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`}
                                  width={64} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                                />
                                <Tooltip
                                  cursor={{ fill: "rgba(99,102,241,0.07)" }}
                                  content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null;
                                    const descriptions: Record<string, string> = {
                                      "Total bruto": "Saldo total acumulado na caixinha no mês",
                                      "Rendimento": "Quanto a caixinha rendeu neste mês",
                                      "Líquido": "Valor líquido estimado após IOF/IR",
                                    };
                                    const colors: Record<string, string> = {
                                      "Total bruto": "#10b981",
                                      "Rendimento": "#f59e0b",
                                      "Líquido": "#3b82f6",
                                    };
                                    return (
                                      <div className="bg-white dark:bg-zinc-900 border rounded-xl shadow-lg p-3.5 min-w-[220px] space-y-2.5">
                                        <p className="text-xs font-bold text-foreground border-b pb-2">{label}</p>
                                        {payload.map((p, i) => {
                                          const key = String(p.dataKey);
                                          return (
                                            <div key={i} className="space-y-0.5">
                                              <div className="flex items-center justify-between gap-4">
                                                <span className="flex items-center gap-1.5 text-sm font-semibold">
                                                  <span className="inline-block w-3 h-3 rounded" style={{ background: colors[key] ?? p.color }} />
                                                  {key}
                                                </span>
                                                <span className="font-bold tabular-nums text-sm">{formatCurrency(Number(p.value))}</span>
                                              </div>
                                              {descriptions[key] && (
                                                <p className="text-xs text-muted-foreground pl-4.5 leading-snug">{descriptions[key]}</p>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  }}
                                />
                                <Legend
                                  iconType="square"
                                  iconSize={10}
                                  formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                                />
                                {selectedTurboMonth && (
                                  <ReferenceLine
                                    x={chartData.find((d) => d.mes === selectedTurboMonth)?.label}
                                    stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2"
                                  />
                                )}
                                <Bar dataKey="Total bruto" fill="#10b981" radius={[4, 4, 0, 0]}
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  shape={(props: any) => {
                                    const isSelected = props.mes === selectedTurboMonth;
                                    const { x, y, width, height } = props;
                                    return <rect x={x} y={y} width={width} height={height} rx={4} fill={isSelected ? "#059669" : "#10b981"} opacity={selectedTurboMonth && !isSelected ? 0.4 : 1} />;
                                  }}
                                />
                                <Bar dataKey="Rendimento" fill="#f59e0b" radius={[4, 4, 0, 0]}
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  shape={(props: any) => {
                                    const isSelected = props.mes === selectedTurboMonth;
                                    const { x, y, width, height } = props;
                                    return <rect x={x} y={y} width={width} height={height} rx={4} fill={isSelected ? "#d97706" : "#f59e0b"} opacity={selectedTurboMonth && !isSelected ? 0.4 : 1} />;
                                  }}
                                />
                                <Bar dataKey="Líquido" fill="#3b82f6" radius={[4, 4, 0, 0]}
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  shape={(props: any) => {
                                    const isSelected = props.mes === selectedTurboMonth;
                                    const { x, y, width, height } = props;
                                    return <rect x={x} y={y} width={width} height={height} rx={4} fill={isSelected ? "#2563eb" : "#3b82f6"} opacity={selectedTurboMonth && !isSelected ? 0.4 : 1} />;
                                  }}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Painel de detalhe do mês selecionado */}
                          {selected && (
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Detalhes do mês</p>
                                  <p className="text-lg font-bold text-indigo-800 dark:text-indigo-300">
                                    {new Date(selected.month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                                  </p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-400 hover:text-indigo-700"
                                  onClick={() => setSelectedTurboMonth(null)}>
                                  ✕
                                </Button>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/40 p-3 text-center">
                                  <p className="text-xs text-emerald-600 mb-1">Total bruto</p>
                                  <p className="text-base font-bold text-emerald-700 tabular-nums">{formatCurrency(selected.total_bruto)}</p>
                                  {prevRecord && (
                                    <p className={`text-xs mt-0.5 tabular-nums ${selected.total_bruto >= prevRecord.total_bruto ? "text-emerald-500" : "text-red-500"}`}>
                                      {selected.total_bruto >= prevRecord.total_bruto ? "▲" : "▼"} {formatCurrency(Math.abs(selected.total_bruto - prevRecord.total_bruto))}
                                    </p>
                                  )}
                                </div>
                                <div className="rounded-lg bg-amber-100 dark:bg-amber-950/40 p-3 text-center">
                                  <p className="text-xs text-amber-600 mb-1">Rendimento</p>
                                  <p className="text-base font-bold text-amber-700 tabular-nums">+{formatCurrency(selected.rendimento)}</p>
                                  {prevRecord && (
                                    <p className={`text-xs mt-0.5 tabular-nums ${selected.rendimento >= prevRecord.rendimento ? "text-emerald-500" : "text-red-500"}`}>
                                      {selected.rendimento >= prevRecord.rendimento ? "▲" : "▼"} {formatCurrency(Math.abs(selected.rendimento - prevRecord.rendimento))} vs mês ant.
                                    </p>
                                  )}
                                </div>
                                <div className="rounded-lg bg-blue-100 dark:bg-blue-950/40 p-3 text-center">
                                  <p className="text-xs text-blue-600 mb-1">Valor líquido</p>
                                  <p className="text-base font-bold text-blue-700 tabular-nums">
                                    {selected.valor_liquido != null ? formatCurrency(selected.valor_liquido) : "—"}
                                  </p>
                                  {selected.valor_liquido != null && prevRecord?.valor_liquido != null && (
                                    <p className={`text-xs mt-0.5 tabular-nums ${selected.valor_liquido >= prevRecord.valor_liquido ? "text-emerald-500" : "text-red-500"}`}>
                                      {selected.valor_liquido >= prevRecord.valor_liquido ? "▲" : "▼"} {formatCurrency(Math.abs(selected.valor_liquido - prevRecord.valor_liquido))}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {selected.total_bruto > 0 && (
                                <div className="text-xs text-indigo-600 pt-1">
                                  Yield do mês: <strong>{((selected.rendimento / (selected.total_bruto - selected.rendimento)) * 100).toFixed(3)}%</strong>
                                  {account.cdi_percent && (
                                    <span className="ml-3 text-muted-foreground">CDI configurado: {account.cdi_percent}%</span>
                                  )}
                                </div>
                              )}
                              <div className="flex justify-end gap-2 pt-1">
                                <Button variant="outline" size="sm" className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50"
                                  onClick={() => { handleDeleteTurboRecord(selected.id); setSelectedTurboMonth(null); }}>
                                  <Trash2 className="h-3 w-3 mr-1" />Excluir mês
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-xs"
                                  onClick={() => {
                                    setTurboMonthForm({ month: selected.month, total_bruto: String(selected.total_bruto), rendimento: String(selected.rendimento), valor_liquido: selected.valor_liquido != null ? String(selected.valor_liquido) : "" });
                                    setTurboMonthOpen(true);
                                  }}>
                                  <Pencil className="h-3 w-3 mr-1" />Editar mês
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Tabela resumo */}
                          <div className="overflow-x-auto -mx-4">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b text-muted-foreground text-xs uppercase">
                                  <th className="text-left py-2 px-4 font-medium whitespace-nowrap">Mês</th>
                                  <th className="text-right py-2 px-4 font-medium whitespace-nowrap">Total bruto</th>
                                  <th className="text-right py-2 px-4 font-medium whitespace-nowrap">Rendimento</th>
                                  <th className="text-right py-2 px-4 font-medium whitespace-nowrap">Valor líquido</th>
                                  <th className="py-2 px-2 w-8" />
                                </tr>
                              </thead>
                              <tbody>
                                {[...turboHistory].reverse().map((r) => (
                                  <tr
                                    key={r.id}
                                    className={`border-b last:border-0 transition-colors cursor-pointer ${r.month === selectedTurboMonth ? "bg-indigo-50 dark:bg-indigo-950/30" : "hover:bg-muted/40"}`}
                                    onClick={() => setSelectedTurboMonth((prev) => prev === r.month ? null : r.month)}
                                  >
                                    <td className="py-2.5 px-4 font-medium whitespace-nowrap">
                                      <span className="flex items-center gap-2">
                                        {r.month === selectedTurboMonth && <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                                        {new Date(r.month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right tabular-nums text-green-600 font-semibold whitespace-nowrap">{formatCurrency(r.total_bruto)}</td>
                                    <td className="py-2.5 px-4 text-right tabular-nums text-amber-600 font-semibold whitespace-nowrap">+{formatCurrency(r.rendimento)}</td>
                                    <td className="py-2.5 px-4 text-right tabular-nums text-blue-600 font-semibold whitespace-nowrap">
                                      {r.valor_liquido != null ? formatCurrency(r.valor_liquido) : "—"}
                                    </td>
                                    <td className="py-2.5 px-2 text-right">
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteTurboRecord(r.id); }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2">
                                  <td className="py-2 px-4 text-xs text-muted-foreground font-semibold whitespace-nowrap">Totais</td>
                                  <td className="py-2 px-4 text-right tabular-nums font-bold text-green-700 whitespace-nowrap">
                                    {formatCurrency(turboHistory[turboHistory.length - 1]?.total_bruto ?? 0)}
                                  </td>
                                  <td className="py-2 px-4 text-right tabular-nums font-bold text-amber-700 whitespace-nowrap">
                                    +{formatCurrency(turboHistory.reduce((s, r) => s + r.rendimento, 0))}
                                  </td>
                                  <td className="py-2 px-4 text-right tabular-nums font-bold text-blue-700 whitespace-nowrap">
                                    {turboHistory[turboHistory.length - 1]?.valor_liquido != null
                                      ? formatCurrency(turboHistory[turboHistory.length - 1].valor_liquido!)
                                      : "—"}
                                  </td>
                                  <td />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Dialog: registrar mês TURBO */}
                <Dialog open={turboMonthOpen} onOpenChange={setTurboMonthOpen}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Registrar mês — {account.name}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>Mês de referência</Label>
                        <Input type="month" value={turboMonthForm.month}
                          onChange={(e) => setTurboMonthForm({ ...turboMonthForm, month: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Rendimento do mês (R$)</Label>
                        <Input type="number" placeholder="Ex: 59,30" autoFocus value={turboMonthForm.rendimento}
                          onChange={(e) => setTurboMonthForm({ ...turboMonthForm, rendimento: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Total bruto no mês (R$) <span className="text-muted-foreground text-xs">opcional</span></Label>
                        <Input type="number" placeholder={`Ex: ${(account.current_balance + (parseFloat(turboMonthForm.rendimento) || 0)).toFixed(2)}`} value={turboMonthForm.total_bruto}
                          onChange={(e) => setTurboMonthForm({ ...turboMonthForm, total_bruto: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor líquido (R$) <span className="text-muted-foreground text-xs">opcional</span></Label>
                        <Input type="number" placeholder="Ex: 5.086,01" value={turboMonthForm.valor_liquido}
                          onChange={(e) => setTurboMonthForm({ ...turboMonthForm, valor_liquido: e.target.value })} />
                      </div>
                      <Button className="w-full" onClick={handleSaveTurboMonth}>Salvar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {!account.is_turbo && (() => {
              const monthlyRendimentos = accountInvestments
                .filter((i) => i.type === "rendimento")
                .reduce((acc, i) => {
                  const m = i.date.slice(0, 7);
                  acc[m] = (acc[m] ?? 0) + i.amount;
                  return acc;
                }, {} as Record<string, number>);
              const rendData = Object.entries(monthlyRendimentos)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([m, v]) => ({
                  mes: m,
                  label: new Date(m + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
                  Rendimento: v,
                }));
              const totalRend = rendData.reduce((s, d) => s + d.Rendimento, 0);
              const lastRend = rendData[rendData.length - 1]?.Rendimento ?? 0;

              return (
                <>
                  {/* Rendimentos mensais — flat section */}
                  <div className="border-t">
                    <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Rendimentos mensais</p>
                        <p className="text-xs text-muted-foreground">
                          {rendData.length > 0
                            ? `${rendData.length} mês${rendData.length !== 1 ? "es" : ""} · total ${formatCurrency(totalRend)}`
                            : "Registre o rendimento de cada mês"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => {
                        setRendMonthForm({ month: format(new Date(), "yyyy-MM"), amount: "", description: "" });
                        setRendMonthOpen(true);
                      }}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Registrar rendimento
                      </Button>
                    </div>
                    {rendData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8 px-4">
                        Nenhum rendimento registrado ainda.
                      </p>
                    ) : (
                      <div className="px-4 py-4 space-y-4">
                        {/* mini-stats flat */}
                        <div className="flex overflow-x-auto divide-x border rounded-xl overflow-hidden">
                          <div className="px-4 py-3 flex-1 min-w-[90px] text-center shrink-0">
                            <p className="text-xs text-amber-600 mb-1">Último mês</p>
                            <p className="text-sm font-bold text-amber-700 tabular-nums">+{formatCurrency(lastRend)}</p>
                          </div>
                          <div className="px-4 py-3 flex-1 min-w-[100px] text-center shrink-0">
                            <p className="text-xs text-blue-600 mb-1">Total acumulado</p>
                            <p className="text-sm font-bold text-blue-700 tabular-nums">+{formatCurrency(totalRend)}</p>
                          </div>
                          <div className="px-4 py-3 flex-1 min-w-[90px] text-center shrink-0">
                            <p className="text-xs text-emerald-600 mb-1">Média mensal</p>
                            <p className="text-sm font-bold text-emerald-700 tabular-nums">+{formatCurrency(totalRend / rendData.length)}</p>
                          </div>
                        </div>
                        {/* gráfico de barras */}
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={rendData} barCategoryGap="35%" barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-white dark:bg-zinc-900 border rounded-xl shadow-lg p-3 min-w-[160px]">
                                    <p className="text-xs font-bold border-b pb-1.5 mb-2">{label}</p>
                                    <div className="flex justify-between text-sm gap-4">
                                      <span className="text-muted-foreground">Rendimento</span>
                                      <span className="font-bold text-amber-600 tabular-nums">+{formatCurrency(Number(payload[0].value))}</span>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Bar dataKey="Rendimento" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Dialog registrar rendimento */}
                  <Dialog open={rendMonthOpen} onOpenChange={setRendMonthOpen}>
                    <DialogContent className="max-w-sm">
                      <DialogHeader><DialogTitle>Registrar rendimento — {account.name}</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label>Mês de referência</Label>
                          <Input type="month" value={rendMonthForm.month}
                            onChange={(e) => setRendMonthForm({ ...rendMonthForm, month: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Valor do rendimento (R$)</Label>
                          <Input type="number" step="0.01" autoFocus placeholder="Ex: 45,30"
                            value={rendMonthForm.amount}
                            onChange={(e) => setRendMonthForm({ ...rendMonthForm, amount: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Descrição <span className="text-muted-foreground text-xs">opcional</span></Label>
                          <Input placeholder="Ex: Juros prefixado set/26"
                            value={rendMonthForm.description}
                            onChange={(e) => setRendMonthForm({ ...rendMonthForm, description: e.target.value })} />
                        </div>
                        <Button className="w-full" onClick={async () => {
                          const amount = parseFloat(rendMonthForm.amount);
                          if (!rendMonthForm.month || !amount) return;
                          const date = rendMonthForm.month + "-01";
                          const desc = rendMonthForm.description.trim() || `Rendimento ${new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
                          await createInvestment({ account_id: account.id, type: "rendimento", amount, description: desc, date });
                          await updateAccountBalance(account.id, computedBalance + amount);
                          setRendMonthOpen(false);
                          setRendMonthForm({ month: format(new Date(), "yyyy-MM"), amount: "", description: "" });
                          load();
                        }}>Salvar</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Gráfico evolução do saldo — flat section */}
                  {chartData.length > 1 && (
                    <div className="border-t">
                      <div className="px-4 py-3 border-b bg-muted/30">
                        <p className="text-sm font-semibold">Evolução do saldo</p>
                        <p className="text-xs text-muted-foreground">Histórico acumulado — {account.name}</p>
                      </div>
                      <div className="px-4 py-4">
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" angle={-25} textAnchor="end" height={50} />
                            <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} />
                            <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Histórico de movimentações — flat lista divide-y */}
                  <div className="border-t">
                    <div className="px-4 py-3 border-b bg-muted/30">
                      <p className="text-sm font-semibold">Histórico de movimentações</p>
                      <p className="text-xs text-muted-foreground">{accountInvestments.length} registro{accountInvestments.length !== 1 ? "s" : ""}</p>
                    </div>
                    {accountInvestments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8 text-sm px-4">Nenhuma movimentação registrada.</p>
                    ) : (
                      <div className="divide-y">
                        {accountInvestments.map((inv) => {
                          const config = TYPE_CONFIG[inv.type];
                          const Icon = config.icon;
                          return (
                            <div key={inv.id}
                              className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3 min-w-0 mr-3">
                                <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />
                                <div className="min-w-0">
                                  <p className="font-medium text-sm">{inv.description || config.label}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                                </div>
                                <Badge className={`${config.badgeClass} shrink-0`}>{config.label}</Badge>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <p className={`font-semibold tabular-nums ${config.color}`}>
                                  {inv.type === "retirada" ? "-" : "+"}{formatCurrency(inv.amount)}
                                </p>
                                <Button variant="ghost" size="icon"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteInvestment(inv)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </>
        )}
    </>
  );
}
