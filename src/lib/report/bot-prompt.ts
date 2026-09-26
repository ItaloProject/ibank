import { RISK_PROFILES } from "@/lib/rebalance";
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
    "- Nunca prometa rentabilidade. Projeções são estimativas com base no Boletim Focus do Banco Central.",
    "- Se perguntarem algo fora de finanças pessoais e investimentos, redirecione com gentileza.",
    "- Termine respostas com recomendação de ação com a frase curta: 'Análise educativa, não é recomendação de investimento.'",
    "",
    "Dados do usuário (JSON):",
    JSON.stringify(contextJson(s)),
  ].join("\n");
}
