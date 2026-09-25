"use client";

import { AlertTriangle, ChevronDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  EQUITY_REAL_RETURN, LONG_TERM_TAX, NEUTRAL_REAL_RATE, YEARS_TO_NEUTRAL,
  type PortfolioReturn,
} from "@/lib/portfolio-return";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function pct(n: number, digits = 1) {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

export function PortfolioRateCard({
  portfolio, anos, liquida, onLiquida, active, onUse, cdi, ipca, updatedAt, live,
}: {
  portfolio: PortfolioReturn;
  anos: number;
  liquida: boolean;
  onLiquida: (v: boolean) => void;
  active: boolean;
  onUse: () => void;
  cdi: number;
  ipca: number;
  updatedAt?: string;
  live: boolean;
}) {
  const media = portfolio.media(anos, liquida);
  const hoje = liquida ? portfolio.hojeLiquida : portfolio.hoje;
  const caixaPeso = portfolio.caixa / portfolio.total;
  const semCaixa = portfolio.hoje + caixaPeso * cdi;
  const presumidas = portfolio.rows.filter((r) => r.presumida);

  return (
    <section id="sim-carteira" aria-labelledby="sim-carteira-titulo" className="scroll-mt-4 rounded-xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 id="sim-carteira-titulo" className="text-sm font-semibold">Rentabilidade da sua carteira</h3>
        <div role="radiogroup" aria-label="Tipo de taxa" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {[
            { v: false, label: "Bruta" },
            { v: true, label: "Líquida de IR" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={liquida === o.v}
              onClick={() => onLiquida(o.v)}
              className={cn(
                "min-h-8 rounded-md px-2.5 text-[11px] font-semibold transition-colors",
                liquida === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                FOCUS,
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 font-display text-4xl font-black leading-none tabular-nums tracking-tight">
        {pct(media, 2)} <span className="text-base font-bold text-muted-foreground">ao ano</span>
      </p>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Média esperada para {anos} {anos === 1 ? "ano" : "anos"}{liquida ? ", já descontado o IR" : ""}. Nos próximos 12 meses:{" "}
        <strong className="font-semibold text-foreground">{pct(hoje, 2)}</strong>. Calculado sobre{" "}
        {formatCurrency(portfolio.total)} em {portfolio.rows.length} {portfolio.rows.length === 1 ? "posição" : "posições"}.
      </p>
      {!active && (
        <button
          type="button"
          onClick={onUse}
          className={cn("mt-3 min-h-10 rounded-md bg-foreground px-4 text-xs font-semibold text-background hover:bg-foreground/90", FOCUS)}
        >
          Usar na simulação
        </button>
      )}

      <ul className="mt-5 divide-y" aria-label="Rentabilidade por posição">
        {portfolio.rows.map((r) => {
          const taxa = r.taxaHoje * (liquida ? 1 - r.ir : 1);
          return (
            <li key={r.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.nome}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.fonte}
                    {liquida && r.ir === 0 && r.classe !== "caixa" ? " · isento de IR" : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("font-display text-base font-black tabular-nums", r.classe === "caixa" && "text-muted-foreground")}>{pct(taxa, 2)}</p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">{formatCurrency(r.valor)} · {pct(r.peso * 100, 0)}</p>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.max(1, r.peso * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      {caixaPeso >= 0.05 && (
        <p className="mt-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {formatCurrency(portfolio.caixa)} parado no saldo em conta não rende e puxa a média para baixo. Aplicado a 100% do CDI,
            a carteira renderia {pct(semCaixa, 2)} nos próximos 12 meses.
          </span>
        </p>
      )}
      {presumidas.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {presumidas.map((r) => r.nome).join(", ")}: sem taxa informada, usamos uma estimativa. Coloque a taxa no nome ou na instituição
          da caixinha (ex.: &quot;110% CDI&quot;) para um cálculo exato.
        </p>
      )}

      <details className="group mt-4 border-t pt-3">
        <summary className={cn("flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-xs font-semibold", FOCUS)}>
          Como calculamos
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
          <li>
            <strong className="font-semibold text-foreground">Pós-fixados (CDI e Selic):</strong> partem do CDI de hoje, {pct(cdi, 2)}
            {live ? ` (Banco Central${updatedAt ? `, ${updatedAt}` : ""})` : " (referência aproximada)"}, e convergem em {YEARS_TO_NEUTRAL} anos
            ao juro neutro de {pct(portfolio.neutro, 2)}: IPCA de {pct(ipca, 2)} mais {NEUTRAL_REAL_RATE}% de juro real, a estimativa do Banco Central.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Prefixados:</strong> a taxa contratada vale até o vencimento; depois, o dinheiro é
            reaplicado a 100% do CDI.
          </li>
          <li>
            <strong className="font-semibold text-foreground">IPCA+:</strong> IPCA dos últimos 12 meses mais o spread contratado.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Ações:</strong> IPCA + {EQUITY_REAL_RETURN}% ao ano, retorno real de longo prazo
            (valorização mais dividendos). Não é garantia: no curto prazo, ações oscilam muito.
          </li>
          <li>
            <strong className="font-semibold text-foreground">FIIs:</strong> dividendos pagos nos últimos 12 meses sobre o preço atual,
            sem contar valorização das cotas.
          </li>
          <li>
            <strong className="font-semibold text-foreground">IR:</strong> na taxa líquida, {pct(LONG_TERM_TAX * 100, 0)} sobre o rendimento de
            renda fixa (acima de 2 anos) e de ações. LCI, LCA, poupança e dividendos de FIIs são isentos. Simplificação: o imposto é descontado
            ano a ano.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Média:</strong> cada posição pesa pelo valor de hoje, e a taxa de cada ano é
            composta ao longo do prazo escolhido.
          </li>
        </ul>
      </details>
    </section>
  );
}
