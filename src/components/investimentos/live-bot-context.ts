import type { RateDraft } from "@/components/investimentos/rate-fields";
import type { useSimulation } from "@/components/investimentos/sim-controls";
import { SECTION_LABEL, type InvestSection } from "@/lib/plan-view";

const TIPO_LABEL = { turbo: "Caixinha Turbo", emergencia: "Reserva de emergência", investimentos: "Renda fixa" } as const;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Resumo do que está aberto no MUVO LIVE, para o assistente responder sobre a tela atual. */
export function liveBotContext(s: {
  tab: string;
  marketOpen: boolean;
  marketSection: InvestSection;
  newCaixinha: { open: boolean; tipo: keyof typeof TIPO_LABEL; nome: string; instituicao: string; rate: RateDraft; cdiMask?: string };
  sim: ReturnType<typeof useSimulation>;
}) {
  const { sim } = s;
  return {
    tela: "MUVO LIVE",
    aba: s.tab,
    janelaInvestir: s.marketOpen ? SECTION_LABEL[s.marketSection] : null,
    novaCaixinha: s.newCaixinha.open
      ? {
          tipo: TIPO_LABEL[s.newCaixinha.tipo],
          nome: s.newCaixinha.nome || null,
          banco: s.newCaixinha.instituicao || null,
          percentualDoCdiTurbo: s.newCaixinha.tipo === "turbo" ? s.newCaixinha.cdiMask || null : undefined,
          indexador: s.newCaixinha.rate.index || null,
          taxa: s.newCaixinha.rate.value || null,
          vencimento: s.newCaixinha.rate.maturity || null,
          isentoDeImpostoDeRenda: s.newCaixinha.rate.exempt,
        }
      : null,
    simulador: s.tab === "simular"
      ? {
          capitalInicial: r2(sim.inicial),
          origemDoCapital: sim.source,
          aporteMensal: sim.mensal,
          meses: sim.meses,
          taxa: sim.rateMode === "cdi" ? `${sim.pctCdi}% do CDI` : `${sim.taxa}% ao mês`,
          taxaAoAno: r2(sim.taxaAnual),
          valorFinal: r2(sim.final),
          totalAportado: r2(sim.aportado),
          juros: r2(sim.rendimento),
        }
      : null,
  };
}
