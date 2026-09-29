import { RISK_PROFILES } from "@/lib/rebalance";
import { bankRatesForBot } from "@/lib/bank-rates";
import type { UserSnapshot } from "@/lib/server/portfolio-snapshot";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Dados da carteira, compactos, para o modelo raciocinar sobre números reais. */
function contextJson(s: UserSnapshot) {
  const plan = s.plan;
  return {
    hoje: s.geradoEm.slice(0, 10),
    nome: s.nome,
    perfil: { id: s.profile, definidoPeloUsuario: s.profileDefinido, alvo: RISK_PROFILES[s.profile].alvo, reservaMeses: RISK_PROFILES[s.profile].reservaMeses },
    aporteMensal: { valor: s.aporte, origem: s.aporteOrigem },
    gastoMensal: s.gastoMensal,
    metaRendaMensal: s.metaRenda,
    mercado: {
      selic: s.rates.selicAnual,
      cdi: s.rates.cdiAnual,
      ipca12m: s.rates.ipca12m ?? null,
      focus: s.rates.focus ? { data: s.rates.focus.data, selicFimDeAno: s.rates.focus.selic, ipcaAno: s.rates.focus.ipca } : null,
    },
    posicoes: (s.portfolio?.rows ?? []).map((r) => ({
      nome: r.nome,
      classe: r.classe,
      valor: r2(r.valor),
      pesoPct: r2(r.peso * 100),
      taxaBruta12mPct: r2(r.taxa12m),
      aliquotaIrLongoPrazo: r.irLongo,
      regra: r.fonte,
      origemDaTaxa: r.origem,
      vencimento: r.rate?.maturity ?? null,
    })),
    ativos: s.holdings.map((h) => ({ ticker: h.ticker, tipo: h.kind, valor: r2(h.valor) })),
    analise: plan
      ? {
          patrimonio: r2(plan.total),
          saldoParado: r2(plan.caixa),
          retornoEsperado12mLiquidoPct: r2(plan.retorno12m),
          reserva: plan.reserva,
          foraDaReserva: r2(plan.investido),
          alocacaoPercentuaisSobre: "valor fora da reserva de emergência (foraDaReserva), não sobre o patrimônio total",
          alocacao: plan.buckets.map((b) => ({ classe: b.label, valor: r2(b.valor), atualPct: r2(b.pct), alvoPct: b.alvoPct, faltaParaAlvo: r2(b.diff) })),
          desvioPct: r2(plan.desvio),
          planoDeAporte: plan.plano.map((a) => ({ classe: a.label, valor: a.valor })),
          sugestoes: plan.sugestoes.map((x) => ({ prioridade: x.prioridade, titulo: x.titulo, detalhe: x.detalhe })),
        }
      : null,
  };
}

export function buildBotSystemPrompt(s: UserSnapshot): string {
  return [
    "Você é o Muvo, assistente de investimentos do app MUVO, falando com um investidor brasileiro pessoa física.",
    "Responda em português do Brasil, de forma direta e calorosa, em no máximo 180 palavras.",
    "Formatação: use **negrito** para números-chave e listas com '- '. Sem títulos com #, sem tabelas, sem emojis.",
    "",
    "Regras:",
    "- Use apenas os dados do JSON abaixo. Se faltar informação, diga o que falta e onde cadastrar no app (taxa das contas no Simular ou no LIVE, gastos no Planejamento, perfil de risco no assistente ou em Configurações, meta em Metas).",
    "- Faça contas com os números reais do usuário. Valores em reais no formato R$ 1.234,56.",
    "- Rebalanceamento: priorize redirecionar aportes em vez de vender; se sugerir venda, lembre do IR (renda fixa: tabela regressiva 22,5% a 15%; ações: 15% sobre o ganho, isento se as vendas de ações no mês somarem até R$ 20 mil; FIIs: 20% sobre o ganho de capital).",
    "- Recomende classes de ativos (pós-fixado, IPCA+, prefixado, FIIs, ações) e produtos genéricos (Tesouro Selic, Tesouro IPCA+, CDB, LCI/LCA). Não indique ações ou fundos específicos para comprar; pode comentar os ativos que o usuário já tem.",
    "- Bancos: você conhece as taxas de caixinhas, cofrinhos, CDB, LCI, LCA e poupança dos bancos em 'taxasDosBancos'. Pode comparar bancos e produtos citando nomes e taxas dessa tabela.",
    "- Ao comparar, converta para rendimento líquido: CDB, RDB e RDC pagam Imposto de Renda (22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% acima); LCI e LCA são isentas, então 90% do CDI em LCA equivale a cerca de 106% do CDI em CDB acima de 2 anos. Poupança rende 0,5% ao mês mais TR quando a Selic está acima de 8,5% ao ano e é isenta.",
    "- Pese liquidez (reserva de emergência só em produto com resgate diário), carência, condições para a taxa turbinada e a garantia de até R$ 250 mil por instituição. Lembre que as taxas mudam e peça para o usuário confirmar no app do banco.",
    "- Nunca prometa rentabilidade. Projeções são estimativas com base no Boletim Focus do Banco Central.",
    "- Se perguntarem algo fora de finanças pessoais e investimentos, redirecione com gentileza.",
    "- Termine respostas com recomendação de ação com a frase curta: 'Análise educativa, não é recomendação de investimento.'",
    "",
    "Dados do usuário (JSON):",
    JSON.stringify(contextJson(s)),
    "",
    "Taxas dos bancos (JSON, chave taxasDosBancos):",
    JSON.stringify(bankRatesForBot()),
  ].join("\n");
}
