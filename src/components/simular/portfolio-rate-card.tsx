"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, Pencil } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { updateAccountRate } from "@/lib/api";
import { NEUTRAL_REAL_RATE } from "@/lib/market-curve";
import { EQUITY_REAL_RETURN, type Portfolio, type PortfolioRow } from "@/lib/portfolio-return";
import { BTN_PRIMARY, BTN_SECONDARY, LiveSheet } from "@/components/investimentos/live-ui";
import { RateFields, draftFromRate, rateFromDraft, type RateDraft } from "@/components/investimentos/rate-fields";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function pct(n: number, digits = 1) {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

export type CurveInfo = {
  source: "focus" | "neutro";
  focusDate?: string;
  selicHoje: number;
  cdiHoje: number;
  selicLonga: number;
  ipcaLongo: number;
  ipcaAno: number;
  live: boolean;
};

const ORIGEM_TEXTO: Record<PortfolioRow["origem"], string | null> = {
  cadastrada: null,
  mercado: null,
  nome: "lida do nome",
  media: "pelo histórico",
  estimada: "estimada",
};

function RateEditor({ row, onClose, onSaved }: { row: PortfolioRow; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<RateDraft>(() => draftFromRate(row.rate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const rate = rateFromDraft(draft);
    if (rate === null) return setError("Escolha como essa aplicação rende.");
    if (typeof rate === "string") return setError(rate);
    setSaving(true);
    setError(null);
    try {
      await updateAccountRate(row.accountId!, rate);
      toast.success("Rentabilidade salva");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <LiveSheet open onOpenChange={(o) => !o && onClose()} title={row.nome} description="Como essa aplicação rende, conforme o contrato ou o app do banco.">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-5">
        <RateFields value={draft} onChange={setDraft} />
        {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={BTN_SECONDARY}>Cancelar</button>
          <button type="submit" disabled={saving || !draft.index} className={BTN_PRIMARY}>{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </LiveSheet>
  );
}

export function PortfolioRateCard({
  portfolio, anos, liquida, media, hoje, active, onUse, curve, onRatesChanged,
}: {
  portfolio: Portfolio;
  anos: number;
  liquida: boolean;
  /** Taxa média anual esperada no prazo (% a.a.), já bruta ou líquida conforme `liquida`. */
  media: number;
  /** Taxa ponderada dos próximos 12 meses (% a.a.). */
  hoje: number;
  active: boolean;
  onUse: () => void;
  curve: CurveInfo;
  onRatesChanged: () => void;
}) {
  const [editing, setEditing] = useState<PortfolioRow | null>(null);
  const caixaPeso = portfolio.caixa / portfolio.total;
  const pendentes = portfolio.rows.filter((r) => r.accountId && (r.origem === "estimada" || r.origem === "nome" || r.origem === "media"));

  return (
    <section id="sim-carteira" aria-labelledby="sim-carteira-titulo" className="scroll-mt-4 rounded-xl border bg-card p-5 sm:p-6">
      <h3 id="sim-carteira-titulo" className="text-sm font-semibold">Rentabilidade da sua carteira</h3>

      <p className="mt-3 font-display text-4xl font-black leading-none tabular-nums tracking-tight">
        {pct(media, 2)} <span className="text-base font-bold text-muted-foreground">ao ano</span>
      </p>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Média esperada para {anos} {anos === 1 ? "ano" : "anos"}{liquida ? ", já sem o imposto de renda" : ", antes do imposto de renda"}.
        Nos próximos 12 meses: <strong className="font-semibold text-foreground">{pct(hoje, 2)}</strong>. Calculado sobre{" "}
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
          const taxa = r.taxa12m * (liquida ? 1 - r.irLongo : 1);
          const origem = ORIGEM_TEXTO[r.origem];
          return (
            <li key={r.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.nome}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.fonte}
                    {origem && (
                      <span className={cn("ml-1.5 rounded px-1 py-px text-[10px] font-semibold", r.origem === "estimada" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
                        {origem}
                      </span>
                    )}
                    {liquida && r.irLongo === 0 && r.classe !== "caixa" ? " · isento de IR" : ""}
                  </p>
                  {r.accountId && (
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className={cn("-ml-1 mt-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground", FOCUS)}
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      {r.origem === "cadastrada" ? "Editar taxa" : "Cadastrar taxa"}
                    </button>
                  )}
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
            {formatCurrency(portfolio.caixa)} parado no saldo em conta não rende nada e puxa a média para baixo. Na simulação, os novos aportes
            vão para as suas aplicações, não para o saldo parado.
          </span>
        </p>
      )}
      {pendentes.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Cadastre a taxa de {pendentes.map((r) => r.nome).join(", ")} para um cálculo exato: hoje ela é{" "}
          {pendentes.length === 1 ? "estimada ou lida do nome da conta" : "estimada ou lida do nome das contas"}.
        </p>
      )}

      <details className="group mt-4 border-t pt-3">
        <summary className={cn("flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-xs font-semibold", FOCUS)}>
          Como calculamos
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
          <li>
            <strong className="font-semibold text-foreground">Juros futuros:</strong>{" "}
            {curve.source === "focus"
              ? <>a Selic parte de {pct(curve.selicHoje, 2)} hoje e segue a mediana do Boletim Focus do Banco Central{curve.focusDate ? ` (${curve.focusDate.split("-").reverse().join("/")})` : ""}, chegando a {pct(curve.selicLonga, 2)}. O IPCA também segue o Focus: {pct(curve.ipcaAno, 2)} este ano e {pct(curve.ipcaLongo, 2)} no longo prazo.</>
              : <>o CDI de hoje, {pct(curve.cdiHoje, 2)}, converge em 3 anos ao juro neutro: IPCA de {pct(curve.ipcaLongo, 2)} mais {NEUTRAL_REAL_RATE}% de juro real.</>}
          </li>
          <li>
            <strong className="font-semibold text-foreground">Mês a mês, posição por posição:</strong> % do CDI incide sobre a taxa diária, como no banco;
            Selic, IPCA e prefixados usam a taxa contratada. No vencimento, o IR é pago e o valor volta a render 100% do CDI. No Turbo, o que passa do teto rende 100% do CDI.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Ações:</strong> IPCA + {EQUITY_REAL_RETURN}% ao ano, retorno real de longo prazo (valorização e dividendos).
            No curto prazo, ações oscilam muito; não é garantia.
          </li>
          <li>
            <strong className="font-semibold text-foreground">FIIs:</strong> proventos pagos nos últimos 12 meses sobre a cotação atual, sem contar valorização das cotas.
            Cotações atualizadas automaticamente.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Imposto de renda:</strong> calculado no resgate, aporte por aporte, pela tabela regressiva (22,5% até 6 meses,
            20% até 1 ano, 17,5% até 2 anos, 15% depois). Ações: 15% sobre o ganho. LCI, LCA, poupança e proventos de FIIs são isentos.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Aportes:</strong> cada novo aporte é dividido entre as suas aplicações na proporção de hoje.
          </li>
        </ul>
      </details>

      {editing && <RateEditor row={editing} onClose={() => setEditing(null)} onSaved={onRatesChanged} />}
    </section>
  );
}
