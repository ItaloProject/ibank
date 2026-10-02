/**
 * Glossário de investimentos usado por todos os assistentes do Muvo:
 * o Gênio e o assistente de investimentos respondem daqui sem custo, e a inteligência artificial recebe as mesmas definições.
 */

export type TermCategory = "Conceitos básicos" | "Renda fixa" | "Renda variável" | "Estratégia e risco" | "Indicadores";

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
];

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

/**
 * Termos do glossário que a mensagem pede para explicar.
 * `bare`: aceita só o nome do termo ("FGC?"); desligado onde o nome sozinho já é um pedido, como "FIIs" para ver a carteira.
 */
export function findTerms(raw: string, opts: { bare?: boolean } = {}): Term[] {
  const t = clean(raw);
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
