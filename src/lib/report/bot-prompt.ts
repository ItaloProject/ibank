import { RISK_PROFILES } from "@/lib/rebalance";
import { bankRatesForBot } from "@/lib/bank-rates";
import type { UserSnapshot } from "@/lib/server/portfolio-snapshot";
import {
  FIXED_INCOME_REFERENCE_DATE,
  RENDA_FIXA_CATALOG,
  fixedRateLabel,
  type FixedIncomeEntry,
} from "@/lib/fixed-income-catalog";
import { tesouroCatalog, type TesouroLive } from "@/lib/tesouro-rates";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Títulos do Tesouro e faixas de renda fixa privada que o app oferece na tela de investir. */
function catalogJson(live: TesouroLive | null) {
  const entry = (e: FixedIncomeEntry) => ({
    nome: e.nome,
    taxa: fixedRateLabel(e.rate_index, e.rate_value),
    vencimento: e.maturity,
    isentoIr: e.tax_exempt,
    resumo: e.descricao,
  });
  const tesouro = tesouroCatalog(live);
  return {
    dataDasTaxasDoTesouro: tesouro.date,
    tesouroDoDia: tesouro.date !== FIXED_INCOME_REFERENCE_DATE,
    dataDasFaixasDeRendaFixaPrivada: FIXED_INCOME_REFERENCE_DATE,
    tesouroDireto: tesouro.catalog.map(entry),
    rendaFixaPrivada: RENDA_FIXA_CATALOG.map(entry),
  };
}

const APP_GUIDE = [
  "Como o app funciona (use para orientar o usuário, citando os nomes exatos dos botões):",
  "- MUVO LIVE (página Investimentos) tem as abas Início, Investimentos e Simular.",
  "- Início: patrimônio, saldo em conta, resultado em bolsa, distribuição (TURBO, Emergência, Renda Fixa, Bolsa), posições em bolsa com os botões Comprar ação e Vender, e Últimas movimentações, onde cada lançamento tem um botão para desfazer.",
  "- Saldo em conta é o dinheiro parado aguardando aplicação: Informar saldo corrige o valor, Investir agora aplica.",
  "- Investir abre: Ações, Fundos imobiliários, Tesouro Direto, Renda fixa (CDB, LCI, LCA, debêntures, CRI, CRA, poupança), Caixinha Turbo e Reserva de emergência. Pode usar o saldo em conta ou dinheiro de fora.",
  "- Nova caixinha cria uma conta: ao escolher o banco o app preenche a taxa do produto; ao escrever o nome (ex.: 'CDB 110% do CDI 2028', 'Tesouro IPCA+ 2032', 'LCA 95% CDI') o app lê indexador, taxa, vencimento e isenção de Imposto de Renda.",
  "- Cada caixinha tem botão para atualizar com o valor que o banco mostra (registra o rendimento) e para excluir.",
  "- Caixinha Turbo rende um percentual acima do CDI até um teto de valor; acima do teto o excedente rende menos.",
  "- Simular projeta aportes e juros com o CDI do dia do Banco Central, com atalhos para usar o patrimônio ou o saldo em conta como capital inicial.",
  "- Metas mostra a renda passiva mensal, a meta de renda e o diagnóstico da carteira; Planejamento guarda os gastos do mês; o perfil de risco fica no assistente ou em Configurações.",
].join("\n");

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
      aliquotaImpostoDeRendaLongoPrazo: r.irLongo,
      regra: r.fonte,
      origemDaTaxa: r.origem,
      vencimento: r.rate?.maturity ?? null,
    })),
    ativos: s.holdings.map((h) => ({ ticker: h.ticker, tipo: h.kind, valor: r2(h.valor) })),
    saldoEmConta: s.saldoEmConta,
    contas: s.accounts,
    bolsa: s.stocks,
    ultimasMovimentacoes: s.movements,
    avisos: s.alerts.map((a) => ({ nivel: a.nivel, titulo: a.titulo, detalhe: a.detalhe })),
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

export function buildBotSystemPrompt(
  s: UserSnapshot,
  pageJson: string | null = null,
  tesouroLive: TesouroLive | null = null,
  dislikes: { pergunta: string; resposta: string }[] = [],
): string {
  const bankRates = bankRatesForBot(s.geradoEm.slice(0, 10));
  return [
    "Você é o Muvo, assistente de investimentos do app MUVO, falando com um investidor brasileiro pessoa física.",
    "Responda em português do Brasil, de forma direta e calorosa, em no máximo 180 palavras.",
    "Formatação: use **negrito** para números-chave e listas com '- '. Sem títulos com #, sem tabelas, sem emojis.",
    "",
    "Regras:",
    "- Use apenas os dados do JSON abaixo. Se faltar informação, diga o que falta e onde cadastrar no app (taxa das contas no Simular ou no LIVE, gastos no Planejamento, perfil de risco no assistente ou em Configurações, meta em Metas).",
    "- Faça contas com os números reais do usuário. Valores em reais no formato R$ 1.234,56.",
    "- Você enxerga tudo o que o usuário vê no app: contas com saldo, grupo e taxa ('contas'), saldo em conta, posições em bolsa com preço médio, preço atual e resultado ('bolsa') e as últimas movimentações. Use isso para responder perguntas como 'por que minha bolsa está negativa', 'quanto aportei este mês' ou 'onde está meu dinheiro parado'.",
    "- Se houver saldo em conta parado, lembre que ele não rende e sugira onde aplicar conforme o perfil.",
    "- 'avisos' são alertas já detectados (dinheiro parado, teto da Turbo, vencimentos, vendas de ações perto de R$ 20 mil no mês). Se o usuário perguntar o que fazer agora ou algo relacionado, comece pelos avisos de nível alta.",
    "- Escreva por extenso: Imposto de Renda, Fundo Garantidor de Créditos, fundos imobiliários, ao ano, ao mês, pontos percentuais. Não use siglas como IR, FGC, FIIs, a.a. ou p.p.",
    "- Rebalanceamento: priorize redirecionar aportes em vez de vender; se sugerir venda, lembre do Imposto de Renda (renda fixa: tabela regressiva 22,5% a 15%; ações: 15% sobre o ganho, isento se as vendas de ações no mês somarem até R$ 20 mil; fundos imobiliários: 20% sobre o ganho de capital).",
    "- Recomende classes de ativos (pós-fixado, IPCA+, prefixado, fundos imobiliários, ações) e produtos genéricos (Tesouro Selic, Tesouro IPCA+, CDB, LCI/LCA). Não indique ações ou fundos específicos para comprar; pode comentar os ativos que o usuário já tem.",
    "- Bancos: você conhece as taxas de caixinhas, cofrinhos, CDB, LCI, LCA e poupança dos bancos em 'taxasDosBancos'. Pode comparar bancos e produtos citando nomes e taxas dessa tabela.",
    "- Ao comparar, converta para rendimento líquido: CDB, RDB e RDC pagam Imposto de Renda (22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% acima); LCI e LCA são isentas, então 90% do CDI em LCA equivale a cerca de 106% do CDI em CDB acima de 2 anos. Poupança rende 0,5% ao mês mais TR quando a Selic está acima de 8,5% ao ano e é isenta.",
    "- Pese liquidez (reserva de emergência só em produto com resgate diário), carência, condições para a taxa turbinada e a garantia de até R$ 250 mil por instituição. Lembre que as taxas mudam e peça para o usuário confirmar no app do banco.",
    `- As taxas dos bancos foram conferidas em ${bankRates.conferidasEm}${bankRates.desatualizadas ? `, há ${bankRates.diasDesdeConferencia} dias: ao citá-las, avise que podem ter mudado` : ""}. As taxas do Tesouro Direto são as de compra de ${tesouroCatalog(tesouroLive).date}; cite essa data ao falar delas.`,
    "- Nunca prometa rentabilidade. Projeções são estimativas com base no Boletim Focus do Banco Central.",
    "- Se perguntarem algo fora de finanças pessoais e investimentos, redirecione com gentileza.",
    "- Termine respostas com recomendação de ação com a frase curta: 'Análise educativa, não é recomendação de investimento.'",
    "- Botões de ação: quando sugerir aplicar ou vender algo concreto, escreva no fim da resposta, cada um em uma linha, até 3 marcadores. O app transforma em botões que abrem a tela já preenchida e o usuário confirma.",
    "  - <<investir:SECAO:VALOR>> com SECAO entre eme (reserva de emergência), rendafixa (CDB, LCI, LCA, debêntures), tesouro, turbo (caixinha Turbo), fiis (fundos imobiliários), acoes ou hub (tela inicial de investir). VALOR em reais, só números, opcional.",
    "  - <<vender:TICKER>> apenas para ativos que o usuário já tem em 'bolsa'.",
    "  - Não mencione os marcadores no texto nem explique a sintaxe.",
    "",
    "Dados do usuário (JSON):",
    JSON.stringify(contextJson(s)),
    "",
    "Taxas dos bancos (JSON, chave taxasDosBancos):",
    JSON.stringify(bankRates),
    "",
    "Catálogo de Tesouro Direto e renda fixa privada do app (JSON; taxas das datas indicadas, variam todo dia):",
    JSON.stringify(catalogJson(tesouroLive)),
    "",
    APP_GUIDE,
    ...(dislikes.length
      ? [
          "",
          "Respostas anteriores que este usuário marcou como ruins (JSON). Entenda o que faltou (dado errado, resposta genérica, longa demais, não respondeu o que foi pedido) e não repita o erro:",
          JSON.stringify(dislikes),
        ]
      : []),
    ...(pageJson
      ? [
          "",
          "Tela que o usuário está vendo agora (JSON). Quando a pergunta falar de 'isso', 'aqui', 'essa taxa' ou 'esse resultado', ela se refere a esta tela:",
          "- novaCaixinha: ele está cadastrando uma aplicação; compare banco e taxa com taxasDosBancos e diga se a taxa está boa, se falta algo e se paga Imposto de Renda.",
          "- simulador: comente os números do simulador (valor final, juros, prazo) e sugira ajustes de aporte ou prazo para a meta dele.",
          "- janelaInvestir: ele está escolhendo onde investir; oriente pela alocação do perfil.",
          pageJson,
        ]
      : []),
  ].join("\n");
}
