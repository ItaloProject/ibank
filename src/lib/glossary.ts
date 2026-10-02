/**
 * Glossário de investimentos usado por todos os assistentes do Muvo:
 * o Gênio e o assistente de investimentos respondem daqui sem custo, e a inteligência artificial recebe as mesmas definições.
 */

import { distance, similar } from "@/lib/genie/fuzzy";

export type TermCategory =
  | "Conceitos básicos" | "Renda fixa" | "Renda variável" | "Estratégia e risco" | "Indicadores"
  | "Impostos e custos" | "Fundos e previdência" | "Dívidas e crédito";

export type Term = {
  id: string;
  name: string;
  category: TermCategory;
  /** Formas de escrever o termo, já sem acentos e em minúsculas. */
  aliases: string[];
  text: string;
  points?: { label: string; value: string }[];
  related?: string[];
};

export const TERMS: Term[] = [
  // 1. Conceitos básicos
  {
    id: "aporte",
    name: "Aporte",
    category: "Conceitos básicos",
    aliases: ["aporte", "aportes", "aportar", "fazer aporte"],
    text: "É colocar dinheiro na sua carteira de investimentos de forma periódica: todo mês, a cada quinze dias ou no ritmo que couber no seu orçamento. É a base para construir patrimônio no longo prazo.",
    points: [
      { label: "Na prática", value: "Investir logo que o salário cai, antes de gastar, ajuda a manter o hábito." },
      { label: "Por que importa", value: "Aportes constantes somados aos juros compostos fazem o patrimônio crescer cada vez mais rápido." },
    ],
    related: ["juros-compostos", "horizonte"],
  },
  {
    id: "renda-ativa",
    name: "Renda ativa",
    category: "Conceitos básicos",
    aliases: ["renda ativa"],
    text: "É o dinheiro que você ganha com o seu trabalho direto: salário, honorários ou prestação de serviços. Se você para de trabalhar, ela para de entrar.",
    related: ["renda-passiva", "aporte"],
  },
  {
    id: "renda-passiva",
    name: "Renda passiva",
    category: "Conceitos básicos",
    aliases: ["renda passiva"],
    text: "É o dinheiro gerado pelos seus investimentos, sem depender do seu esforço diário: dividendos de ações, juros da renda fixa ou rendimentos de fundos imobiliários.",
    points: [{ label: "Objetivo", value: "Com o tempo, a renda passiva pode cobrir parte ou todo o seu custo de vida." }],
    related: ["renda-ativa", "dividendos", "fiis"],
  },
  {
    id: "juros-compostos",
    name: "Juros compostos",
    category: "Conceitos básicos",
    aliases: ["juros compostos", "juro composto", "juros sobre juros"],
    text: "São os \"juros sobre juros\": o rendimento de um período passa a render também nos períodos seguintes. Por isso o patrimônio cresce cada vez mais rápido com o passar do tempo.",
    points: [{ label: "Exemplo", value: "R$ 1.000 a 1% ao mês viram R$ 1.010 no primeiro mês; no segundo, o 1% incide sobre R$ 1.010, e assim por diante." }],
    related: ["aporte", "horizonte"],
  },
  {
    id: "inflacao",
    name: "Inflação",
    category: "Conceitos básicos",
    aliases: ["inflacao"],
    text: "É a perda do poder de compra do dinheiro com o tempo: a mesma quantia compra menos coisas. Seu investimento precisa render acima da inflação para você ficar mais rico de verdade.",
    points: [{ label: "No Brasil", value: "A inflação oficial é medida pelo IPCA (Índice Nacional de Preços ao Consumidor Amplo)." }],
    related: ["ipca", "tesouro-ipca"],
  },

  // 2. Renda fixa
  {
    id: "renda-fixa",
    name: "Renda fixa",
    category: "Renda fixa",
    aliases: ["renda fixa"],
    text: "Investimentos em que a regra de rendimento é definida no momento da aplicação: uma taxa fixa, um percentual do CDI ou a inflação mais uma taxa.",
    points: [{ label: "Exemplos", value: "Tesouro Direto, CDB, LCI e LCA." }],
    related: ["tesouro-direto", "cdb", "lci-lca"],
  },
  {
    id: "tesouro-direto",
    name: "Tesouro Direto",
    category: "Renda fixa",
    aliases: ["tesouro direto", "titulos publicos", "titulo publico"],
    text: "São títulos públicos emitidos pelo Governo Federal. É considerado o investimento mais seguro do país, com o menor risco de calote.",
    points: [{ label: "Principais tipos", value: "Tesouro Selic, Tesouro IPCA+ e Tesouro Prefixado." }],
    related: ["tesouro-selic", "tesouro-ipca"],
  },
  {
    id: "tesouro-selic",
    name: "Tesouro Selic",
    category: "Renda fixa",
    aliases: ["tesouro selic"],
    text: "Título público que acompanha a taxa Selic, a taxa básica de juros da economia. Tem alta liquidez (dá para resgatar rápido) e oscila pouco, por isso é ideal para a reserva de emergência.",
    related: ["reserva-emergencia", "selic", "liquidez"],
  },
  {
    id: "tesouro-ipca",
    name: "Tesouro IPCA+",
    category: "Renda fixa",
    aliases: ["tesouro ipca", "tesouro ipva", "tesouro inflacao", "ipca mais"],
    text: "Título público que paga uma taxa fixa mais a variação da inflação (IPCA). Protege o poder de compra no longo prazo, por isso combina com objetivos como aposentadoria.",
    points: [{ label: "Atenção", value: "Se resgatar antes do vencimento, o valor pode estar abaixo do aplicado, porque o preço do título oscila." }],
    related: ["inflacao", "ipca", "horizonte"],
  },
  {
    id: "cdb",
    name: "CDB (Certificado de Depósito Bancário)",
    category: "Renda fixa",
    aliases: ["cdb", "cdbs", "certificado de deposito bancario"],
    text: "Título emitido por bancos para captar dinheiro: você empresta ao banco e recebe juros. CDBs de grandes bancos costumam render um percentual do CDI, como 100% do CDI.",
    points: [
      { label: "Proteção", value: "Coberto pelo FGC até R$ 250 mil por CPF e por instituição." },
      { label: "Imposto de Renda", value: "Tem desconto de Imposto de Renda sobre o rendimento, menor quanto mais tempo o dinheiro fica aplicado." },
    ],
    related: ["cdi", "fgc", "lci-lca"],
  },
  {
    id: "cdi",
    name: "CDI (Certificado de Depósito Interbancário)",
    category: "Indicadores",
    aliases: ["cdi", "certificado de deposito interbancario", "taxa di"],
    text: "É a taxa dos empréstimos de curtíssimo prazo entre bancos. Ela anda praticamente colada na Selic e é a referência de rendimento da renda fixa: \"100% do CDI\" quer dizer render o mesmo que essa taxa.",
    related: ["selic", "cdb"],
  },
  {
    id: "selic",
    name: "Taxa Selic",
    category: "Indicadores",
    aliases: ["selic", "taxa selic", "taxa basica de juros"],
    text: "É a taxa básica de juros da economia, definida pelo Banco Central. Quando a Selic sobe, a renda fixa passa a render mais; quando cai, rende menos.",
    related: ["cdi", "tesouro-selic"],
  },
  {
    id: "ipca",
    name: "IPCA (Índice Nacional de Preços ao Consumidor Amplo)",
    category: "Indicadores",
    aliases: ["ipca", "indice nacional de precos ao consumidor amplo"],
    text: "É o índice oficial da inflação no Brasil, medido pelo IBGE. É ele que o Tesouro IPCA+ usa para corrigir o seu dinheiro.",
    related: ["inflacao", "tesouro-ipca"],
  },
  {
    id: "fgc",
    name: "FGC (Fundo Garantidor de Créditos)",
    category: "Renda fixa",
    aliases: ["fgc", "fundo garantidor de creditos", "fundo garantidor de credito", "fundo garantidor"],
    text: "Proteção que devolve até R$ 250 mil por CPF e por instituição financeira se o banco emissor quebrar. Vale para CDB, LCI, LCA, LC, poupança e outros.",
    points: [{ label: "Teto geral", value: "Somando todas as instituições, o limite é de R$ 1 milhão a cada 4 anos." }],
    related: ["cdb", "lci-lca"],
  },
  {
    id: "lci-lca",
    name: "LCI e LCA (Letras de Crédito Imobiliário e do Agronegócio)",
    category: "Renda fixa",
    aliases: ["lci", "lca", "lcis", "lcas", "letra de credito imobiliario", "letras de credito imobiliario", "letra de credito do agronegocio", "letras de credito do agronegocio"],
    text: "Títulos emitidos por bancos para financiar o setor imobiliário (LCI) e o agronegócio (LCA). São isentos de Imposto de Renda para pessoas físicas.",
    points: [
      { label: "Proteção", value: "Cobertas pelo FGC até R$ 250 mil por CPF e por instituição." },
      { label: "Comparando", value: "Por não ter imposto, uma LCI a 90% do CDI pode render mais que um CDB a 100% do CDI." },
    ],
    related: ["cdb", "fgc"],
  },
  {
    id: "poupanca",
    name: "Poupança",
    category: "Renda fixa",
    aliases: ["poupanca", "caderneta de poupanca"],
    text: "A aplicação mais conhecida do país: isenta de Imposto de Renda e coberta pelo FGC, mas costuma render menos que o Tesouro Selic e CDBs de 100% do CDI.",
    related: ["tesouro-selic", "cdb"],
  },
  {
    id: "liquidez",
    name: "Liquidez",
    category: "Estratégia e risco",
    aliases: ["liquidez", "liquidez diaria"],
    text: "É a rapidez com que um investimento vira dinheiro na conta sem perder valor. Liquidez diária quer dizer que você pode resgatar em qualquer dia útil.",
    related: ["reserva-emergencia", "tesouro-selic"],
  },

  // 3. Renda variável
  {
    id: "renda-variavel",
    name: "Renda variável",
    category: "Renda variável",
    aliases: ["renda variavel"],
    text: "Investimentos sem rendimento garantido: o preço sobe e desce conforme a oferta e a procura no mercado. Podem render mais no longo prazo, mas com mais risco.",
    points: [{ label: "Exemplos", value: "Ações, fundos imobiliários e ETFs." }],
    related: ["acoes", "fiis", "etfs"],
  },
  {
    id: "acoes",
    name: "Ações",
    category: "Renda variável",
    aliases: ["acao", "acoes"],
    text: "São pedaços de uma empresa negociados na bolsa de valores. Ao comprar uma ação, você vira sócio da empresa e pode ganhar com a valorização do papel e com dividendos.",
    related: ["dividendos", "etfs", "diversificacao"],
  },
  {
    id: "dividendos",
    name: "Dividendos",
    category: "Renda variável",
    aliases: ["dividendo", "dividendos", "proventos"],
    text: "Parte do lucro que a empresa distribui aos acionistas em dinheiro. É uma das formas de renda passiva com ações.",
    related: ["acoes", "renda-passiva"],
  },
  {
    id: "fiis",
    name: "FIIs (Fundos de Investimento Imobiliário)",
    category: "Renda variável",
    aliases: ["fii", "fiis", "fundo imobiliario", "fundos imobiliarios", "fundo de investimento imobiliario", "fundos de investimento imobiliario"],
    text: "Fundos que juntam o dinheiro de vários investidores para aplicar em imóveis (shoppings, galpões logísticos, escritórios) ou em títulos do setor imobiliário. Negociados na bolsa.",
    points: [{ label: "Rendimentos", value: "Costumam pagar todo mês, e na maioria dos casos esse rendimento é isento de Imposto de Renda para pessoas físicas." }],
    related: ["renda-passiva", "acoes"],
  },
  {
    id: "etfs",
    name: "ETFs (fundos de índice)",
    category: "Renda variável",
    aliases: ["etf", "etfs", "fundo de indice", "fundos de indice", "exchange traded fund"],
    text: "Fundos negociados na bolsa que copiam um índice, como o Ibovespa ou o S&P 500. Com uma única compra você investe em dezenas ou centenas de empresas.",
    related: ["diversificacao", "acoes"],
  },

  // 4. Estratégias e gestão de risco
  {
    id: "reserva-emergencia",
    name: "Reserva de emergência",
    category: "Estratégia e risco",
    aliases: ["reserva de emergencia", "reserva emergencial", "fundo de emergencia"],
    text: "Dinheiro equivalente a 6 a 12 meses do seu custo de vida, guardado em investimentos de altíssima liquidez e baixo risco, como Tesouro Selic ou CDB de liquidez diária. É só para imprevistos, como perda de emprego ou problemas de saúde.",
    points: [{ label: "Primeiro passo", value: "Monte a reserva antes de partir para investimentos de mais risco." }],
    related: ["tesouro-selic", "liquidez"],
  },
  {
    id: "diversificacao",
    name: "Diversificação",
    category: "Estratégia e risco",
    aliases: ["diversificacao", "diversificar"],
    text: "É não colocar todos os ovos na mesma cesta: distribuir o dinheiro entre renda fixa, ações, fundos imobiliários e ativos internacionais, e entre setores diferentes, para reduzir o risco da carteira.",
    related: ["etfs", "horizonte"],
  },
  {
    id: "horizonte",
    name: "Horizonte de investimento",
    category: "Estratégia e risco",
    aliases: ["horizonte de investimento", "horizonte do investimento", "horizonte"],
    text: "É o tempo que o dinheiro vai ficar investido antes de você precisar dele. Objetivos de curto prazo pedem renda fixa conservadora; objetivos de longo prazo aceitam mais renda variável.",
    related: ["renda-fixa", "renda-variavel", "diversificacao"],
  },
  {
    id: "perfil-investidor",
    name: "Perfil de investidor",
    category: "Estratégia e risco",
    aliases: ["perfil de investidor", "perfil do investidor", "suitability", "perfil de risco"],
    text: "É a classificação do quanto de risco e oscilação você aceita: conservador, moderado ou arrojado. Bancos e corretoras são obrigados a perguntar antes de oferecer investimentos.",
    points: [{ label: "No Muvo", value: "O assistente de investimentos usa o seu perfil para sugerir a divisão da carteira." }],
    related: ["diversificacao", "rebalanceamento"],
  },
  {
    id: "rebalanceamento",
    name: "Rebalanceamento",
    category: "Estratégia e risco",
    aliases: ["rebalanceamento", "rebalancear carteira"],
    text: "É ajustar a carteira de volta para a divisão planejada quando uma parte cresce demais ou de menos. O jeito mais barato é direcionar os próximos aportes para o que ficou abaixo, sem vender.",
    related: ["diversificacao", "perfil-investidor", "aporte"],
  },
  {
    id: "juros-simples",
    name: "Juros simples",
    category: "Conceitos básicos",
    aliases: ["juros simples", "juro simples"],
    text: "Juros calculados sempre sobre o valor inicial, sem render sobre os juros anteriores. Quase nenhum investimento usa; é útil para entender a diferença para os juros compostos.",
    related: ["juros-compostos"],
  },
  {
    id: "rentabilidade-real",
    name: "Rentabilidade real",
    category: "Conceitos básicos",
    aliases: ["rentabilidade real", "rendimento real", "ganho real", "juro real", "juros reais"],
    text: "É quanto o investimento rendeu acima da inflação, ou seja, quanto o seu poder de compra cresceu de verdade.",
    points: [{ label: "Conta", value: "(1 + rendimento) ÷ (1 + inflação) − 1. Rendendo 12% com inflação de 4,5%, o ganho real é de 7,18%." }],
    related: ["inflacao", "tesouro-ipca"],
  },
  {
    id: "rentabilidade-liquida",
    name: "Rentabilidade bruta e líquida",
    category: "Impostos e custos",
    aliases: ["rentabilidade liquida", "rentabilidade bruta", "rendimento liquido", "rendimento bruto"],
    text: "A rentabilidade bruta é o que o investimento rende antes de impostos e taxas; a líquida é o que realmente fica com você depois do Imposto de Renda e das taxas.",
    points: [{ label: "Por que importa", value: "Para comparar um CDB com uma LCI, compare sempre o líquido." }],
    related: ["imposto-renda", "lci-lca", "cdb"],
  },

  // Impostos e custos
  {
    id: "imposto-renda",
    name: "Imposto de Renda nos investimentos",
    category: "Impostos e custos",
    aliases: ["imposto de renda", "tabela regressiva", "imposto regressivo"],
    text: "Na renda fixa, o imposto incide só sobre o rendimento e cai quanto mais tempo o dinheiro fica aplicado: 22,5% até 180 dias, 20% até 360 dias, 17,5% até 720 dias e 15% acima disso. É descontado automaticamente no resgate.",
    points: [
      { label: "Isentos", value: "LCI, LCA, poupança, debêntures incentivadas e a maioria dos rendimentos de fundos imobiliários." },
      { label: "Ações", value: "15% sobre o lucro nas vendas, com isenção se as vendas de ações no mês somarem até R$ 20 mil." },
    ],
    related: ["iof", "rentabilidade-liquida", "isencao-acoes"],
  },
  {
    id: "iof",
    name: "IOF (Imposto sobre Operações Financeiras)",
    category: "Impostos e custos",
    aliases: ["iof", "imposto sobre operacoes financeiras"],
    text: "Imposto cobrado sobre o rendimento quando você resgata uma aplicação de renda fixa em menos de 30 dias. Começa em 96% do rendimento no primeiro dia e chega a zero no trigésimo.",
    points: [{ label: "Dica", value: "Para não pagar IOF, deixe o dinheiro aplicado pelo menos 30 dias." }],
    related: ["imposto-renda", "liquidez"],
  },
  {
    id: "come-cotas",
    name: "Come-cotas",
    category: "Impostos e custos",
    aliases: ["come cotas", "comecotas"],
    text: "Antecipação do Imposto de Renda cobrada em maio e novembro nos fundos de investimento: o fundo reduz a quantidade de cotas para pagar o imposto sobre o rendimento do semestre.",
    points: [{ label: "Efeito", value: "Como parte do rendimento sai antes, sobra menos dinheiro rendendo juros compostos." }],
    related: ["fundos-investimento", "imposto-renda"],
  },
  {
    id: "taxa-administracao",
    name: "Taxa de administração",
    category: "Impostos e custos",
    aliases: ["taxa de administracao", "taxa de adm"],
    text: "Percentual ao ano cobrado pelos fundos de investimento para pagar a gestão, descontado todo dia do valor das cotas, mesmo quando o fundo não rende.",
    points: [{ label: "Referência", value: "Em fundos de renda fixa simples, taxas acima de 1% ao ano costumam comer boa parte do rendimento." }],
    related: ["taxa-performance", "fundos-investimento"],
  },
  {
    id: "taxa-performance",
    name: "Taxa de performance",
    category: "Impostos e custos",
    aliases: ["taxa de performance", "taxa de desempenho"],
    text: "Parte do lucro cobrada pelo gestor do fundo quando ele rende acima de uma meta, como o CDI ou o Ibovespa. É comum ser 20% do que passar da meta.",
    related: ["taxa-administracao", "fundos-investimento"],
  },
  {
    id: "custodia",
    name: "Taxa de custódia",
    category: "Impostos e custos",
    aliases: ["taxa de custodia", "custodia"],
    text: "Taxa pela guarda dos seus títulos e ativos. No Tesouro Direto é de 0,20% ao ano; no Tesouro Selic, só sobre o que passar de R$ 10 mil. Muitas corretoras não cobram nada pela custódia de ações.",
    related: ["tesouro-direto"],
  },
  {
    id: "isencao-acoes",
    name: "Isenção na venda de ações",
    category: "Impostos e custos",
    aliases: ["isencao de acoes", "isencao das acoes", "isencao para acoes", "isencao na venda de acoes", "isencao de vinte mil"],
    text: "Quem vende ações no mercado à vista somando até R$ 20 mil em vendas no mês não paga Imposto de Renda sobre o lucro. Acima disso, paga 15% sobre o lucro.",
    points: [{ label: "Não vale para", value: "Day trade, fundos imobiliários e ETFs, que pagam imposto sobre qualquer lucro." }],
    related: ["acoes", "darf", "day-trade"],
  },
  {
    id: "darf",
    name: "DARF (Documento de Arrecadação de Receitas Federais)",
    category: "Impostos e custos",
    aliases: ["darf", "documento de arrecadacao de receitas federais"],
    text: "Guia para pagar impostos à Receita Federal. Na bolsa, você mesmo emite e paga o DARF até o último dia útil do mês seguinte à venda com lucro tributável.",
    related: ["isencao-acoes", "imposto-renda"],
  },

  // Renda fixa: tipos e regras
  {
    id: "prefixado",
    name: "Prefixado",
    category: "Renda fixa",
    aliases: ["prefixado", "pre fixado", "prefixados"],
    text: "Investimento com taxa definida no dia da aplicação, como 12% ao ano. Você sabe exatamente quanto vai receber no vencimento, mas perde se os juros do país subirem muito depois.",
    related: ["pos-fixado", "tesouro-prefixado", "marcacao-mercado"],
  },
  {
    id: "pos-fixado",
    name: "Pós-fixado",
    category: "Renda fixa",
    aliases: ["pos fixado", "posfixado", "pos fixados"],
    text: "Investimento que acompanha um indicador, como o CDI ou a Selic: se os juros sobem, rende mais; se caem, rende menos. É o tipo mais indicado para a reserva de emergência.",
    related: ["prefixado", "cdi", "tesouro-selic"],
  },
  {
    id: "tesouro-prefixado",
    name: "Tesouro Prefixado",
    category: "Renda fixa",
    aliases: ["tesouro prefixado", "tesouro pre fixado", "ltn"],
    text: "Título público com taxa fixa definida na compra. Combina com objetivos com data marcada que coincida com o vencimento.",
    points: [{ label: "Atenção", value: "Vender antes do vencimento pode dar prejuízo se os juros tiverem subido (marcação a mercado)." }],
    related: ["prefixado", "marcacao-mercado", "tesouro-direto"],
  },
  {
    id: "marcacao-mercado",
    name: "Marcação a mercado",
    category: "Renda fixa",
    aliases: ["marcacao a mercado", "marcacao de mercado"],
    text: "É a atualização diária do preço de um título pelo valor que o mercado pagaria por ele hoje. Por isso o saldo do Tesouro IPCA+ ou Prefixado pode cair de um dia para o outro, mesmo sendo renda fixa.",
    points: [{ label: "No vencimento", value: "Quem leva o título até o fim recebe exatamente a taxa contratada." }],
    related: ["tesouro-ipca", "tesouro-prefixado", "vencimento"],
  },
  {
    id: "carencia",
    name: "Carência",
    category: "Renda fixa",
    aliases: ["carencia", "periodo de carencia"],
    text: "Prazo mínimo em que o dinheiro fica preso antes de poder ser resgatado. LCI e LCA, por exemplo, costumam ter carência de alguns meses.",
    related: ["liquidez", "vencimento", "lci-lca"],
  },
  {
    id: "vencimento",
    name: "Vencimento",
    category: "Renda fixa",
    aliases: ["vencimento", "data de vencimento"],
    text: "Data em que o título termina e o dinheiro, com o rendimento combinado, volta para a sua conta.",
    related: ["carencia", "marcacao-mercado"],
  },
  {
    id: "debentures",
    name: "Debêntures",
    category: "Renda fixa",
    aliases: ["debenture", "debentures", "debenture incentivada", "debentures incentivadas"],
    text: "Títulos emitidos por empresas para captar dinheiro: você empresta para a empresa e recebe juros. As debêntures incentivadas, de infraestrutura, são isentas de Imposto de Renda.",
    points: [{ label: "Risco", value: "Não têm a garantia do FGC: se a empresa quebrar, você pode perder o dinheiro." }],
    related: ["cri-cra", "fgc"],
  },
  {
    id: "cri-cra",
    name: "CRI e CRA (Certificados de Recebíveis Imobiliários e do Agronegócio)",
    category: "Renda fixa",
    aliases: ["cri", "cra", "certificado de recebiveis imobiliarios", "certificado de recebiveis do agronegocio"],
    text: "Títulos de empresas lastreados em dívidas do setor imobiliário (CRI) e do agronegócio (CRA). São isentos de Imposto de Renda para pessoas físicas.",
    points: [{ label: "Risco", value: "Não têm a garantia do FGC." }],
    related: ["debentures", "lci-lca"],
  },
  {
    id: "lc",
    name: "LC (Letra de Câmbio)",
    category: "Renda fixa",
    aliases: ["lc", "letra de cambio", "letras de cambio"],
    text: "Título emitido por financeiras, parecido com o CDB. Costuma pagar taxas maiores e tem a garantia do FGC.",
    related: ["cdb", "fgc"],
  },
  {
    id: "rdb",
    name: "RDB (Recibo de Depósito Bancário)",
    category: "Renda fixa",
    aliases: ["rdb", "rdbs", "recibo de deposito bancario"],
    text: "Título de banco parecido com o CDB, mas que não pode ser vendido para outra pessoa antes do vencimento. Tem a garantia do FGC e paga Imposto de Renda.",
    related: ["cdb", "fgc"],
  },

  // Renda variável: indicadores e mercado
  {
    id: "ibovespa",
    name: "Ibovespa",
    category: "Renda variável",
    aliases: ["ibovespa", "ibov", "indice bovespa"],
    text: "Principal índice da bolsa brasileira: mostra o desempenho médio das ações mais negociadas. Serve de régua para comparar a sua carteira de ações.",
    related: ["acoes", "etfs"],
  },
  {
    id: "dividend-yield",
    name: "Dividend yield",
    category: "Renda variável",
    aliases: ["dividend yield", "dy", "rendimento de dividendos"],
    text: "Quanto uma ação ou fundo imobiliário pagou de dividendos ou rendimentos nos últimos 12 meses, em relação ao preço atual. Um dividend yield de 8% quer dizer que pagou 8% do preço em um ano.",
    points: [{ label: "Cuidado", value: "Um número muito alto pode vir de um pagamento extraordinário ou de uma queda forte no preço." }],
    related: ["dividendos", "fiis"],
  },
  {
    id: "preco-lucro",
    name: "P/L (preço sobre lucro)",
    category: "Renda variável",
    aliases: ["p l", "preco lucro", "preco sobre lucro"],
    text: "Divide o preço da ação pelo lucro por ação da empresa. Indica em quantos anos o lucro atual pagaria o preço: um P/L baixo pode indicar ação barata, ou uma empresa com problemas.",
    related: ["preco-valor-patrimonial", "acoes"],
  },
  {
    id: "preco-valor-patrimonial",
    name: "P/VP (preço sobre valor patrimonial)",
    category: "Renda variável",
    aliases: ["p vp", "pvp", "preco sobre valor patrimonial", "preco valor patrimonial"],
    text: "Compara o preço na bolsa com o valor patrimonial (o que a empresa ou o fundo tem de bens menos dívidas). Muito usado em fundos imobiliários: abaixo de 1 indica cota negociada abaixo do valor dos imóveis.",
    related: ["preco-lucro", "fiis"],
  },
  {
    id: "bdr",
    name: "BDR (Brazilian Depositary Receipt)",
    category: "Renda variável",
    aliases: ["bdr", "bdrs"],
    text: "Certificado negociado na bolsa brasileira que representa ações de empresas estrangeiras, como Apple ou Amazon. É um jeito de investir lá fora em reais.",
    related: ["investimento-exterior", "acoes"],
  },
  {
    id: "investimento-exterior",
    name: "Investimento no exterior",
    category: "Renda variável",
    aliases: ["investimento no exterior", "investir no exterior", "investimentos no exterior", "investir fora do brasil"],
    text: "Aplicar em ativos de outros países, diretamente por corretoras internacionais ou daqui, por BDRs e ETFs. Diversifica a carteira e protege parte do patrimônio da alta do dólar.",
    related: ["bdr", "etfs", "diversificacao"],
  },
  {
    id: "volatilidade",
    name: "Volatilidade",
    category: "Estratégia e risco",
    aliases: ["volatilidade", "volatil"],
    text: "É o quanto o preço de um investimento sobe e desce. Ações e criptomoedas são muito voláteis; o Tesouro Selic quase não oscila.",
    related: ["horizonte", "perfil-investidor"],
  },
  {
    id: "preco-medio",
    name: "Preço médio",
    category: "Renda variável",
    aliases: ["preco medio"],
    text: "É o valor médio pago por ação ou cota somando todas as suas compras, incluindo as taxas. É ele que define se você teve lucro ou prejuízo ao vender, e o imposto a pagar.",
    related: ["acoes", "darf"],
  },
  {
    id: "day-trade",
    name: "Day trade e swing trade",
    category: "Renda variável",
    aliases: ["day trade", "daytrade", "swing trade"],
    text: "Day trade é comprar e vender o mesmo ativo no mesmo dia; swing trade é segurar por dias ou semanas. São operações de curto prazo, de alto risco, e a maioria das pessoas físicas perde dinheiro com elas.",
    points: [{ label: "Imposto", value: "Day trade paga 20% sobre o lucro, sem isenção." }],
    related: ["volatilidade", "isencao-acoes"],
  },
  {
    id: "criptomoedas",
    name: "Criptomoedas",
    category: "Renda variável",
    aliases: ["criptomoeda", "criptomoedas", "cripto", "criptoativos", "bitcoin"],
    text: "Moedas digitais, como o bitcoin, sem governo ou banco central por trás. São extremamente voláteis: podem subir ou cair mais de 50% em pouco tempo.",
    points: [{ label: "Se for investir", value: "Use só uma parte pequena da carteira, que você aceite perder." }],
    related: ["volatilidade", "diversificacao"],
  },

  // Fundos e previdência
  {
    id: "fundos-investimento",
    name: "Fundos de investimento",
    category: "Fundos e previdência",
    aliases: ["fundo de investimento", "fundos de investimento", "cotas de fundo"],
    text: "Um condomínio de investidores: o dinheiro de todos é juntado e um gestor profissional decide onde aplicar. Você compra cotas e paga taxa de administração.",
    points: [{ label: "Compare", value: "Rendimento líquido, taxa de administração, prazo de resgate e se tem come-cotas." }],
    related: ["taxa-administracao", "come-cotas", "multimercado"],
  },
  {
    id: "multimercado",
    name: "Fundo multimercado",
    category: "Fundos e previdência",
    aliases: ["multimercado", "fundo multimercado", "fundos multimercado"],
    text: "Fundo que pode investir em várias classes ao mesmo tempo: juros, ações, câmbio e mercado internacional. O resultado depende muito da habilidade do gestor.",
    related: ["fundos-investimento", "taxa-performance"],
  },
  {
    id: "previdencia",
    name: "Previdência privada (PGBL e VGBL)",
    category: "Fundos e previdência",
    aliases: ["previdencia", "previdencia privada", "pgbl", "vgbl"],
    text: "Fundos para a aposentadoria. No PGBL você deduz até 12% da renda bruta do Imposto de Renda, mas paga imposto sobre todo o valor no resgate; no VGBL não deduz e paga imposto só sobre o rendimento.",
    points: [
      { label: "PGBL", value: "Para quem faz a declaração completa do Imposto de Renda e contribui para o INSS." },
      { label: "VGBL", value: "Para quem faz a declaração simplificada ou já passou do limite de 12%." },
    ],
    related: ["imposto-renda", "taxa-administracao", "horizonte"],
  },

  // Dívidas e crédito
  {
    id: "rotativo",
    name: "Rotativo do cartão",
    category: "Dívidas e crédito",
    aliases: ["rotativo", "rotativo do cartao", "credito rotativo"],
    text: "É o que acontece quando você paga menos que o total da fatura: o restante vira um empréstimo com os juros mais caros do país. Por lei, só pode ficar no rotativo por um mês, e os juros não podem passar do valor original da dívida.",
    points: [{ label: "Saída", value: "Parcelar a fatura ou trocar por um empréstimo mais barato custa menos." }],
    related: ["cheque-especial", "cet"],
  },
  {
    id: "cheque-especial",
    name: "Cheque especial",
    category: "Dívidas e crédito",
    aliases: ["cheque especial", "limite da conta"],
    text: "Limite que o banco libera quando a conta fica negativa. É cobrado juros desde o primeiro dia, com teto de 8% ao mês por lei, o que passa de 150% ao ano.",
    points: [{ label: "Saída", value: "Use a reserva de emergência ou troque por um empréstimo pessoal ou consignado." }],
    related: ["rotativo", "consignado", "reserva-emergencia"],
  },
  {
    id: "cet",
    name: "CET (Custo Efetivo Total)",
    category: "Dívidas e crédito",
    aliases: ["cet", "custo efetivo total"],
    text: "É o custo real de um empréstimo ou financiamento, somando juros, tarifas, seguros e impostos. Os bancos são obrigados a informar; compare sempre o CET, não só a taxa de juros.",
    related: ["consignado", "sac-price"],
  },
  {
    id: "sac-price",
    name: "SAC e Tabela Price",
    category: "Dívidas e crédito",
    aliases: ["sac", "tabela sac", "price", "tabela price", "sistema de amortizacao constante"],
    text: "São os dois jeitos mais comuns de pagar um financiamento. No SAC as parcelas começam maiores e caem todo mês; na Price as parcelas são iguais do começo ao fim, mas o total de juros é maior.",
    points: [{ label: "Calcule", value: "Pergunte, por exemplo, \"SAC ou Price para 200 mil em 360 meses a 0,8% ao mês\"." }],
    related: ["cet", "consorcio"],
  },
  {
    id: "consorcio",
    name: "Consórcio",
    category: "Dívidas e crédito",
    aliases: ["consorcio", "consorcios"],
    text: "Grupo de pessoas que paga parcelas mensais para comprar um bem; todo mês alguns são contemplados por sorteio ou lance. Não tem juros, mas cobra taxa de administração, e você não sabe quando vai receber.",
    points: [{ label: "Comparado ao financiamento", value: "Costuma sair mais barato, mas só serve para quem pode esperar." }],
    related: ["sac-price", "cet"],
  },
  {
    id: "consignado",
    name: "Empréstimo consignado",
    category: "Dívidas e crédito",
    aliases: ["consignado", "emprestimo consignado", "credito consignado"],
    text: "Empréstimo com as parcelas descontadas direto do salário ou da aposentadoria. Por ter menos risco para o banco, tem um dos juros mais baixos do mercado.",
    points: [{ label: "Atenção", value: "A parcela sai antes de o dinheiro chegar na sua conta: não comprometa o orçamento do mês." }],
    related: ["cheque-especial", "rotativo", "cet"],
  },
  {
    id: "piramide",
    name: "Pirâmide financeira e golpes",
    category: "Estratégia e risco",
    aliases: ["piramide financeira", "piramide", "esquema ponzi", "golpe financeiro", "golpes financeiros"],
    text: "Esquema que promete ganhos altos e garantidos, mas paga os antigos participantes com o dinheiro dos novos, até quebrar. Promessa de retorno garantido muito acima do CDI é o principal sinal de golpe.",
    points: [{ label: "Como checar", value: "Veja se a empresa tem registro na Comissão de Valores Mobiliários ou no Banco Central e desconfie de pressa para investir." }],
    related: ["fgc", "perfil-investidor"],
  },
];

/** Exemplos práticos para "dá um exemplo" depois de uma definição. */
const EXAMPLES: Record<string, string> = {
  aporte: "Quem investe R$ 300 todo dia 5, assim que recebe o salário, está fazendo aportes mensais de R$ 300.",
  "renda-ativa": "O salário de R$ 4.000 que cai todo mês pelo seu trabalho é renda ativa.",
  "renda-passiva": "Ter R$ 120 mil em fundos imobiliários que pagam 0,8% ao mês gera cerca de R$ 960 por mês sem você trabalhar por eles.",
  "juros-compostos": "R$ 10 mil a 1% ao mês viram R$ 11.268 em 1 ano e R$ 33.004 em 10 anos. Com juros simples seriam R$ 22 mil em 10 anos.",
  inflacao: "Se a inflação do ano foi 5%, o que custava R$ 100 passa a custar R$ 105. Um investimento que rendeu 4% perdeu poder de compra.",
  "tesouro-selic": "Com a Selic a 13% ao ano, R$ 10 mil no Tesouro Selic rendem cerca de R$ 1.300 brutos em 1 ano, e você pode resgatar em qualquer dia útil.",
  "tesouro-ipca": "Um Tesouro IPCA+ que paga IPCA + 6%, num ano de inflação de 4,5%, rende cerca de 10,8% no ano.",
  cdb: "R$ 10 mil num CDB a 100% do CDI, com CDI de 13% ao ano, rendem R$ 1.300 brutos em 1 ano; descontado o Imposto de Renda de 20%, ficam R$ 1.040.",
  cdi: "Um CDB que paga 110% do CDI, com o CDI a 13% ao ano, rende 14,3% ao ano antes do imposto.",
  fgc: "Se você tem R$ 300 mil em CDBs de um banco que quebra, o FGC devolve R$ 250 mil. Com R$ 150 mil em dois bancos diferentes, tudo estaria coberto.",
  "lci-lca": "Uma LCI a 90% do CDI rende o mesmo que um CDB a cerca de 106% do CDI aplicado por mais de 2 anos, porque não paga Imposto de Renda.",
  acoes: "Comprar 100 ações de uma empresa a R$ 30 custa R$ 3.000. Se a ação sobe para R$ 36, você ganha R$ 600, fora os dividendos.",
  dividendos: "Uma empresa que paga R$ 2 por ação em dividendos no ano rende R$ 200 para quem tem 100 ações.",
  fiis: "Um fundo imobiliário com cota de R$ 100 que paga R$ 0,90 por mês: com 100 cotas, você recebe R$ 90 por mês, sem Imposto de Renda.",
  etfs: "Comprando uma cota de um ETF que copia o Ibovespa, você passa a investir nas cerca de 80 maiores empresas da bolsa de uma vez.",
  "reserva-emergencia": "Quem gasta R$ 3.000 por mês deve ter de R$ 18 mil a R$ 36 mil guardados no Tesouro Selic ou num CDB de liquidez diária.",
  diversificacao: "Em vez de colocar R$ 10 mil numa única ação, dividir em Tesouro, CDB, fundos imobiliários e um ETF reduz o estrago se uma delas cair.",
  liquidez: "O Tesouro Selic cai na conta no mesmo dia ou no seguinte; um imóvel pode levar meses para virar dinheiro.",
  horizonte: "Dinheiro para a viagem do ano que vem vai para a renda fixa; dinheiro para a aposentadoria daqui a 25 anos pode ter uma parte em ações.",
  iof: "Resgatar no décimo dia um CDB que rendeu R$ 50 faz o IOF levar R$ 33 (66% do rendimento).",
  "sac-price": "Em 200 mil por 30 anos a 0,8% ao mês, a primeira parcela do SAC é cerca de R$ 2.156 e a da Price R$ 1.696, mas o SAC economiza mais de R$ 120 mil em juros no total.",
  rotativo: "R$ 1.000 deixados no rotativo a 14% ao mês viram R$ 1.140 no mês seguinte.",
  "cheque-especial": "Ficar R$ 2.000 negativo por um mês a 8% custa R$ 160 só de juros.",
};

export function termExample(term: Term): string | null {
  return EXAMPLES[term.id] ?? null;
}

const BY_ID = new Map(TERMS.map((t) => [t.id, t]));

export function termById(id: string): Term | undefined {
  return BY_ID.get(id);
}

function clean(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES = TERMS.flatMap((t) => t.aliases.map((a) => ({ term: t, alias: a })))
  .sort((a, b) => b.alias.length - a.alias.length);

/** Pedido de definição: "o que é", "explica", "diferença entre", "como funciona". */
const ASKS_DEFINITION = /^(?:(?:mas|e|entao|genio|muvo)\s+)?(?:o que (?:e|sao|significa|quer dizer|seria|seriam)|oque (?:e|sao)|que e|qual (?:e )?(?:o significado|a definicao)|significado|significa|defin[ae]|explica|explique|me explica|me explique|como funciona|como funcionam|diferenca|qual a diferenca|qual e a diferenca|me fala (?:sobre|de|do|da|o que e)|fale sobre|fala sobre|o que voce sabe sobre|voce sabe o que e|sabe o que e)\b|\b(?:o que e|o que sao|o que significa|significa o que|e o que)$/;
/** Comparações e conselhos pedem análise, não definição. */
const ASKS_ADVICE = /\b(?:melhor|pior|vale a pena|compensa|rende mais|devo|deveria|quanto|onde|quando|recomenda|indica)\b/;
const FILLER = new Set(["o", "a", "os", "as", "e", "ou", "um", "uma", "de", "do", "da", "dos", "das", "entre", "sobre", "que", "eh", "isso", "vs", "versus", "x"]);

/** Palavras dos nomes dos termos, para corrigir erros de digitação ("tezouro", "debentur"). */
const VOCAB = [...new Set(TERMS.flatMap((t) => t.aliases.flatMap((a) => a.split(" "))).filter((w) => w.length >= 4))];
/** Palavras dos pedidos de definição, que nunca são corrigidas. */
const KEEP = new Set("o que sao significa quer dizer seria seriam qual significado definicao defina define explica explique como funciona funcionam diferenca fala fale sobre voce sabe isso esse essa rende rendem rendeu minha minhas".split(" "));

function fixTermTypos(t: string): string {
  return t.split(" ").map((w) => {
    if (w.length < 4 || KEEP.has(w) || FILLER.has(w) || VOCAB.includes(w)) return w;
    const best = VOCAB.filter((v) => similar(w, v)).sort((a, b) => distance(w, a) - distance(w, b))[0];
    return best ?? w;
  }).join(" ");
}

/**
 * Termos do glossário que a mensagem pede para explicar.
 * `bare`: aceita só o nome do termo ("FGC?"); desligado onde o nome sozinho já é um pedido, como "FIIs" para ver a carteira.
 */
export function findTerms(raw: string, opts: { bare?: boolean } = {}): Term[] {
  const t = clean(raw);
  const fixed = fixTermTypos(t);
  const typed = fixed !== t ? matchTerms(fixed, opts) : [];
  return typed.length ? typed : matchTerms(t, opts);
}

/** Pedido de continuação depois de uma definição. */
const FOLLOW_EXAMPLE = /^(?:(?:me |pode |poderia )?(?:da|de|dar|mostra|mostre|tem|traz)\s+(?:um |uns |algum )?exemplos?|exemplos?|um exemplo|por exemplo|como assim|explica melhor|explique melhor|explica de novo|explica mais simples|mais simples|de um jeito mais simples|nao entendi|nao entendi direito|na pratica|e na pratica|como (?:fica|e) na pratica|tipo o que)(?: genio| muvo)?$/;

export function asksExample(raw: string): boolean {
  return FOLLOW_EXAMPLE.test(clean(raw));
}

function matchTerms(t: string, opts: { bare?: boolean }): Term[] {
  if (!t || /\d/.test(t) || t.split(" ").length > 14 || ASKS_ADVICE.test(t)) return [];
  let rest = ` ${t} `;
  const hits: { term: Term; at: number }[] = [];
  for (const { term, alias } of ALIASES) {
    const at = rest.indexOf(` ${alias} `);
    if (at < 0) continue;
    rest = `${rest.slice(0, at)} ${" ".repeat(alias.length)} ${rest.slice(at + alias.length + 2)}`;
    if (!hits.some((h) => h.term.id === term.id)) hits.push({ term, at });
  }
  if (!hits.length) return [];
  const leftover = rest.trim().split(/\s+/).filter((w) => w && !FILLER.has(w));
  const bare = leftover.length === 0;
  if (!ASKS_DEFINITION.test(t) && !(opts.bare !== false && bare)) return [];
  return hits.sort((a, b) => a.at - b.at).slice(0, 3).map((h) => h.term);
}

/** Tipos de ativo da bolsa que correspondem a cada termo. */
const HOLDING_KIND: Record<string, RegExp> = { fiis: /fii/, acoes: /acao|acoes|stock/, etfs: /etf/ };

/**
 * Quanto a pessoa tem no produto do termo, para ligar a definição à carteira dela.
 * Procura o nome do termo nas aplicações cadastradas e nos tipos de ativo da bolsa.
 */
export function holdingsFor(
  term: Term,
  sources: { nome: string; tipo: string; capital: number }[],
  holdings: { ticker: string; kind: string; value: number }[],
): { total: number; count: number } | null {
  if (!["Renda fixa", "Renda variável"].includes(term.category) || term.id === "renda-fixa" || term.id === "renda-variavel" || term.id === "fgc") return null;
  let total = 0;
  let count = 0;
  for (const s of sources) {
    const n = ` ${clean(`${s.nome} ${s.tipo}`)} `;
    if (s.capital > 0 && term.aliases.some((a) => n.includes(` ${a} `))) { total += s.capital; count++; }
  }
  const kind = HOLDING_KIND[term.id];
  if (kind) {
    for (const h of holdings) if (h.value > 0 && kind.test(clean(h.kind))) { total += h.value; count++; }
  }
  return count ? { total, count } : null;
}

/** Pergunta pronta para os botões de termos relacionados. */
export function askAbout(term: Term): string {
  return `o que é ${term.name.replace(/\s*\(.*\)$/, "")}?`;
}

/** Definição em texto corrido, com Markdown simples, para o assistente de investimentos. */
export function termMarkdown(term: Term): string {
  const lines = [`**${term.name}**`, "", term.text];
  for (const p of term.points ?? []) lines.push("", `**${p.label}:** ${p.value}`);
  return lines.join("\n");
}

/** Definições resumidas para a inteligência artificial usar as mesmas explicações dos outros assistentes. */
export function glossaryForPrompt(): string {
  return TERMS.map((t) => `- ${t.name}: ${t.text}`).join("\n");
}
