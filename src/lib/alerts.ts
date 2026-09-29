/**
 * Avisos que o assistente mostra sem o usuário perguntar: dinheiro parado,
 * caixinha Turbo acima do teto, vencimentos próximos e vendas de ações perto
 * do limite de isenção de Imposto de Renda (R$ 20 mil por mês).
 */
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";
import { isCashAccountName } from "@/lib/account-groups";
import { accountBalance, detectAssetType } from "@/lib/stock-utils";
import type { BotAction } from "@/lib/plan-view";

export type BotAlert = {
  id: string;
  nivel: "alta" | "media";
  titulo: string;
  detalhe: string;
  acao?: BotAction;
};

export const LIMITE_ISENCAO_ACOES = 20000;
const DIA = 24 * 3600 * 1000;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const diasEntre = (de: string, ate: string) => Math.round((new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / DIA);
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function buildAlerts(input: {
  accounts: InvestmentAccount[];
  investments: Investment[];
  trades: StockTrade[];
  today?: Date;
}): BotAlert[] {
  const today = input.today ?? new Date();
  const hoje = ymd(today);
  const alerts: BotAlert[] = [];

  for (const a of input.accounts) {
    if (!isCashAccountName(a.name)) continue;
    const saldo = accountBalance(input.investments, a.id);
    if (saldo < 50) continue;
    const ultima = input.investments.filter((i) => i.account_id === a.id).map((i) => i.date).sort().pop();
    const dias = ultima ? diasEntre(ultima, hoje) : 0;
    if (dias >= 7) {
      alerts.push({
        id: `parado-${ultima}`,
        nivel: dias >= 30 ? "alta" : "media",
        titulo: `${brl(saldo)} parados há ${dias} dias no saldo em conta`,
        detalhe: "Saldo em conta não rende. Aplique no que o seu plano indica ou na reserva de emergência.",
        acao: { kind: "investir", section: "hub", amount: saldo },
      });
    }
  }

  for (const a of input.accounts) {
    if (!a.is_turbo || !a.max_rendimento || a.max_rendimento <= 0) continue;
    const excedente = (Number(a.current_balance) || 0) - a.max_rendimento;
    if (excedente >= 50) {
      alerts.push({
        id: `teto-${a.id}`,
        nivel: "media",
        titulo: `${a.name} passou do teto em ${brl(excedente)}`,
        detalhe: "O que passa do teto rende menos. Leve o excedente para um CDB acima de 100% do CDI ou para o Tesouro.",
        acao: { kind: "investir", section: "rendafixa", amount: excedente },
      });
    }
  }

  for (const a of input.accounts) {
    if (!a.maturity) continue;
    const saldo = a.is_turbo ? Number(a.current_balance) || 0 : accountBalance(input.investments, a.id);
    if (saldo < 1) continue;
    const dias = diasEntre(hoje, a.maturity.slice(0, 10));
    if (dias >= 0 && dias <= 30) {
      alerts.push({
        id: `vence-${a.id}`,
        nivel: dias <= 7 ? "alta" : "media",
        titulo: `${a.name} vence ${dias === 0 ? "hoje" : `em ${dias} ${dias === 1 ? "dia" : "dias"}`} (${dataBr(a.maturity)})`,
        detalhe: `Planeje onde reaplicar ${brl(saldo)} para o dinheiro não ficar parado.`,
      });
    } else if (dias < 0 && dias >= -60) {
      alerts.push({
        id: `venceu-${a.id}`,
        nivel: "alta",
        titulo: `${a.name} venceu em ${dataBr(a.maturity)}`,
        detalhe: "Registre o resgate no saldo em conta e reaplique, ou atualize o vencimento se você renovou.",
      });
    }
  }

  const mes = hoje.slice(0, 7);
  const vendas = input.trades
    .filter((t) => t.type === "venda" && t.date.slice(0, 7) === mes && detectAssetType(t.ticker) === "Ação")
    .reduce((s, t) => s + (Number(t.total_amount) || 0), 0);
  const nomeMes = MESES[today.getMonth()];
  if (vendas > LIMITE_ISENCAO_ACOES) {
    alerts.push({
      id: `vendas-${mes}`,
      nivel: "alta",
      titulo: `Vendas de ações passaram de R$ 20 mil em ${nomeMes}: ${brl(vendas)}`,
      detalhe: "O lucro dessas vendas paga 15% de Imposto de Renda. O DARF vence no último dia útil do mês seguinte.",
    });
  } else if (vendas >= LIMITE_ISENCAO_ACOES * 0.75) {
    alerts.push({
      id: `vendas-${mes}`,
      nivel: "media",
      titulo: `Faltam ${brl(LIMITE_ISENCAO_ACOES - vendas)} para o limite de isenção em ${nomeMes}`,
      detalhe: `Você já vendeu ${brl(vendas)} em ações neste mês. Até R$ 20 mil o lucro é isento de Imposto de Renda; acima disso, paga 15%.`,
    });
  }

  return alerts.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alta" ? -1 : 1));
}
