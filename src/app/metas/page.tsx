"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/user-context";
import { Target, TrendingUp, Landmark, Calendar, DollarSign, ChevronRight, Calculator, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function calcProjecao(aporte: number, anos: number, taxaAnual = 0.08): number {
  const taxaMensal = Math.pow(1 + taxaAnual, 1 / 12) - 1;
  const meses = anos * 12;
  return aporte * ((Math.pow(1 + taxaMensal, meses) - 1) / taxaMensal) * (1 + taxaMensal);
}

function calcAporteNecessario(meta: number, anos: number, taxaAnual = 0.08): number {
  const taxaMensal = Math.pow(1 + taxaAnual, 1 / 12) - 1;
  const meses = anos * 12;
  return meta / (((Math.pow(1 + taxaMensal, meses) - 1) / taxaMensal) * (1 + taxaMensal));
}

export default function MetasPage() {
  const { investmentProfile } = useUser();
  const isAposentadoria = investmentProfile === "aposentadoria";

  const anoAtual = new Date().getFullYear();

  // Aposentadoria
  const [valorAlvo, setValorAlvo] = useState("");
  const [prazoAno, setPrazoAno] = useState(String(anoAtual + 20));
  const [aporteAtual, setAporteAtual] = useState("");

  // Renda Mensal
  const [metaRenda, setMetaRenda] = useState("");
  const [rendaAtual, setRendaAtual] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcBreakdown, setCalcBreakdown] = useState<{ label: string; value: number }[] | null>(null);

  const loadGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/goals");
      const data = await res.json();
      if (data.goal_target) {
        if (isAposentadoria) setValorAlvo(String(data.goal_target));
        else setMetaRenda(String(data.goal_target));
      }
      if (data.goal_deadline_year) setPrazoAno(String(data.goal_deadline_year));
      if (data.goal_monthly_contribution) {
        if (isAposentadoria) setAporteAtual(String(data.goal_monthly_contribution));
        else setRendaAtual(String(data.goal_monthly_contribution));
      }
    } catch {}
    setLoading(false);
  }, [isAposentadoria]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  async function calcularRenda() {
    setCalcLoading(true);
    setCalcBreakdown(null);
    try {
      // Busca proventos (dividendos mensais cadastrados)
      const [provRes, invRes] = await Promise.all([
        fetch("/api/proventos"),
        fetch("/api/investments"),
      ]);
      const provData = await provRes.json();
      const invData = await invRes.json();

      const breakdown: { label: string; value: number }[] = [];

      // Soma todos os proventos (FIIs, dividendos, JCP - são mensais)
      const proventos = Array.isArray(provData) ? provData : [];
      const totalProventos = proventos.reduce((s: number, p: Record<string, unknown>) => s + (Number(p.amount) || 0), 0);
      if (totalProventos > 0) {
        breakdown.push({ label: `Proventos (${proventos.length} ativos)`, value: totalProventos });
      }

      // Soma rendimentos de investimentos (tipo "rendimento")
      const invList = Array.isArray(invData) ? invData : [];
      const totalRendimentos = invList
        .filter((i: Record<string, unknown>) => i.type === "rendimento")
        .reduce((s: number, i: Record<string, unknown>) => s + (Number(i.amount) || 0), 0);
      if (totalRendimentos > 0) {
        breakdown.push({ label: "Rendimentos (renda fixa)", value: totalRendimentos });
      }

      const total = totalProventos + totalRendimentos;
      setCalcBreakdown(breakdown);
      setRendaAtual(total > 0 ? String(Math.round(total * 100) / 100) : rendaAtual);
    } catch {}
    setCalcLoading(false);
  }

  async function salvar() {
    setSaving(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal_target: isAposentadoria ? Number(valorAlvo) || null : Number(metaRenda) || null,
        goal_deadline_year: isAposentadoria ? Number(prazoAno) || null : null,
        goal_monthly_contribution: isAposentadoria ? Number(aporteAtual) || null : Number(rendaAtual) || null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // Cálculos Aposentadoria
  const anos = Math.max(1, Number(prazoAno) - anoAtual);
  const projecao = calcProjecao(Number(aporteAtual) || 0, anos);
  const aporteNecessario = calcAporteNecessario(Number(valorAlvo) || 0, anos);
  const progresso = valorAlvo ? Math.min(100, (projecao / Number(valorAlvo)) * 100) : 0;

  // Cálculos Renda Mensal
  const percRenda = metaRenda ? Math.min(100, ((Number(rendaAtual) || 0) / Number(metaRenda)) * 100) : 0;
  const faltaRenda = Math.max(0, Number(metaRenda) - (Number(rendaAtual) || 0));

  if (loading) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="border-b pb-4 flex items-center gap-2">
        {isAposentadoria
          ? <Landmark className="h-5 w-5 text-blue-500" />
          : <TrendingUp className="h-5 w-5 text-emerald-500" />}
        <div>
          <h1 className="text-xl font-bold">Minha Meta</h1>
          <p className="text-sm text-muted-foreground">{isAposentadoria ? "Aposentadoria" : "Renda Mensal"}</p>
        </div>
      </div>

      {isAposentadoria ? (
        <>
          {/* Formulário Aposentadoria */}
          <section className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Valor alvo (R$)
              </span>
              <input
                type="number"
                min="0"
                placeholder="Ex: 2000000"
                value={valorAlvo}
                onChange={(e) => setValorAlvo(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Ano de aposentadoria
              </span>
              <input
                type="number"
                min={anoAtual + 1}
                max={anoAtual + 50}
                value={prazoAno}
                onChange={(e) => setPrazoAno(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Aporte mensal atual (R$)
              </span>
              <input
                type="number"
                min="0"
                placeholder="Ex: 1500"
                value={aporteAtual}
                onChange={(e) => setAporteAtual(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </label>
          </section>

          {/* Projeção */}
          {(valorAlvo || aporteAtual) && (
            <section className="border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projeção · {anos} anos · 8% a.a. real</p>
              </div>
              <div className="grid grid-cols-2 divide-x">
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Projeção atual</p>
                  <p className={cn("text-base font-bold mt-0.5", projecao >= Number(valorAlvo || 0) ? "text-emerald-500" : "text-foreground")}>
                    {fmt(projecao)}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Aporte necessário</p>
                  <p className="text-base font-bold mt-0.5">{valorAlvo ? fmt(aporteNecessario) : "—"}</p>
                </div>
              </div>
              {valorAlvo && (
                <div className="px-4 pb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progresso da meta</span>
                    <span>{progresso.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", progresso >= 100 ? "bg-emerald-500" : "bg-blue-500")}
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {progresso >= 100
                      ? "Parabéns! Sua projeção já supera a meta."
                      : `Faltam ${fmt(Number(valorAlvo) - projecao)} para atingir a meta com o aporte atual.`}
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          {/* Formulário Renda Mensal */}
          <section className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Meta de renda mensal (R$)
              </span>
              <input
                type="number"
                min="0"
                placeholder="Ex: 5000"
                value={metaRenda}
                onChange={(e) => setMetaRenda(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Renda passiva atual (R$/mês)
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Ex: 1200"
                  value={rendaAtual}
                  onChange={(e) => { setRendaAtual(e.target.value); setCalcBreakdown(null); }}
                  className="flex-1 border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={calcularRenda}
                  disabled={calcLoading}
                  title="Calcular com base nos investimentos"
                  className="flex items-center gap-1.5 border rounded-xl px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-colors disabled:opacity-50 shrink-0"
                >
                  {calcLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Calculator className="h-3.5 w-3.5" />}
                  {calcLoading ? "..." : "Calcular"}
                </button>
              </div>
              {calcBreakdown !== null && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Base de cálculo</p>
                  {calcBreakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum dado encontrado. Cadastre proventos ou rendimentos em Investimentos.</p>
                  ) : (
                    calcBreakdown.map((b) => (
                      <div key={b.label} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{b.label}</span>
                        <span className="text-xs font-semibold tabular-nums text-emerald-600">
                          {b.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))
                  )}
                  {calcBreakdown.length > 0 && (
                    <div className="flex items-center justify-between border-t border-emerald-500/20 pt-1.5 mt-0.5">
                      <span className="text-xs font-semibold text-foreground">Total preenchido</span>
                      <span className="text-xs font-bold tabular-nums text-emerald-600">
                        {(calcBreakdown.reduce((s, b) => s + b.value, 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Progresso Renda */}
          {metaRenda && (
            <section className="border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progresso da Meta</p>
              </div>
              <div className="grid grid-cols-2 divide-x">
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Renda atual</p>
                  <p className="text-base font-bold mt-0.5 text-emerald-500">{fmt(Number(rendaAtual) || 0)}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Falta alcançar</p>
                  <p className="text-base font-bold mt-0.5">{fmt(faltaRenda)}</p>
                </div>
              </div>
              <div className="px-4 pb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{fmt(Number(rendaAtual) || 0)} de {fmt(Number(metaRenda))}</span>
                  <span>{percRenda.toFixed(0)}%</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", percRenda >= 100 ? "bg-emerald-500" : "bg-emerald-400")}
                    style={{ width: `${percRenda}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {percRenda >= 100
                    ? "Parabéns! Você já atingiu sua meta de renda passiva."
                    : `Você atingiu ${percRenda.toFixed(0)}% da sua meta de renda mensal.`}
                </p>
              </div>
            </section>
          )}
        </>
      )}

      {/* Salvar */}
      <button
        type="button"
        onClick={salvar}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
      >
        {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Meta"}
        {!saving && !saved && <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
