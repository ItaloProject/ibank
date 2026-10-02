import { NUMBER_RE, normalize, parseNumber } from "./calc";
import { similar } from "./fuzzy";

const N = NUMBER_RE;

/**
 * Reescreve gírias e jeitos comuns de falar num formato que o Gênio já entende.
 * Recebe e devolve texto normalizado (minúsculo, sem acentos).
 */
export function canonicalize(input: string): string {
  let t = ` ${input} `;
  const sub = (re: RegExp, rep: string) => { t = t.replace(re, rep); };

  // Dinheiro: "50 conto", "80 pila", "2 barão"
  sub(new RegExp(String.raw`(\d+)\s*(?:baroes|barao)\b`, "g"), "$1 mil");
  sub(/\bum barao\b/g, "1 mil");
  sub(new RegExp(String.raw`(${N})\s*(?:contos?|pilas?|mangos?|paus?|reais|real|dinheiros?|pratas?)\b`, "g"), "$1");
  sub(/\b(?:uns|umas|tipo|mais ou menos|cerca de|uns? \d+ e pouco)\s+(?=\d)/g, "");
  t = t.trim();

  // Começos que só introduzem o pedido: "anota aí que gastei", "registra um gasto de"
  sub(/^(?:anota|anote|registra|registre|marca|marque|lanca|lance|coloca|bota|salva|salve)\s+(?:ai\s+)?(?:que\s+)?(?=(?:eu\s+)?(?:gastei|paguei|recebi|comprei|torrei)\b)/, "");
  sub(/^(?:registra|registre|anota|anote|lanca|lance)\s+(?:ai\s+)?(?:um|uma)\s+(gasto|despesa|compra)\s+de\b/, "gastei");
  sub(/^(?:registra|registre|anota|anote|lanca|lance|adiciona|adicione|coloca|coloque)\s+(?:ai\s+)?(?:uma?\s+)?(?:entrada|receita)\s+de\b/, "recebi");
  sub(/^eu\s+(?=gastei|paguei|recebi|comprei)/, "");

  // "marca a luz como paga"
  sub(/^(?:marca|marque|marcar|deixa|deixe|coloca|coloque)\s+(?:o\s+|a\s+)?(.+?)\s+como\s+pag[oa]s?$/, "paguei $1");
  sub(/^(.+?)\s+(?:ja\s+)?(?:esta|ta|tá|foi|ficou)\s+pag[oa]$/, "paguei $1");

  // Gasto real
  sub(/^(?:rachei|desembolsei|deixei|larguei|queimei|meti|dei|gastou|gastaram|gastamos|gasto(?!\s+(?:real|reais)$)|tive um gasto de|tive gasto de|fiz uma compra de|fiz um gasto de|fiz uma comprinha de|comprinha de|compra de)\s+/, "gastei ");
  sub(new RegExp(String.raw`^(?:saiu|sairam|foi embora|foram embora)\s+(${N})\s+`), "gastei $1 ");
  sub(/^(?:pagamos|pago)\s+/, "paguei ");

  // Renda
  sub(/^(?:caiu|cairam|pingou|pingaram|recebemos|me pagaram|me mandaram|ganhamos|entraram)\s+/, "recebi ");

  // Grupo novo: "abre uma pasta pra viagem"
  sub(/\b(cri[aeo]r?|crie|abr[aei]r?|mont[aeo]r?|faz(?:er)?|faca|nov[oa])\s+(?:um\s+|uma\s+)?(?:pasta|caixinha|envelope|secao|aba|lista|bloco)\b/g, "$1 grupo");

  // Apagar
  sub(/^(?:joga|jogue|jogar)\s+fora\s+/, "apagar ");
  sub(/^(?:tira|tire|tirar)\s+fora\s+/, "apagar ");
  sub(/^(?:some com|sumir com|limpa|limpe|limpar|cancela|cancele|cancelar|esquece|esqueca)\s+/, "apagar ");

  // Adicionar ("pode pôr" chega aqui como "por" depois de tirar o "pode")
  sub(/^por\s+(?=.*\d)/, "adicionar ");
  sub(/^(?:bota|bote|botar|joga|jogue|jogar|mete|enfia|soca|anota|anote|anotar|registra|registre|registrar|cadastra|cadastre|cadastrar|acrescenta|acrescente|acrescentar|insere|insira|inserir|salva|salve|salvar|pode por|pode colocar)\s+(?:ai\s+)?/, "adicionar ");

  // Valor planejado: "o limite do mercado é 800", "gastar no máximo 300 com lazer", "netflix subiu pra 60"
  sub(new RegExp(String.raw`^(?:o\s+|a\s+)?(?:orcamento|limite|teto|meta|planejado)\s+(?:d[eoa]s?|pro|pra|para o|para a|com)\s+(.+?)\s+(?:e|=|de|sera|fica|vai ser|agora e)?\s*(${N})$`), "muda $1 para $2");
  sub(new RegExp(String.raw`^(?:planejo |pretendo |vou |posso )?gastar\s+(?:no maximo\s+|ate\s+|so\s+)?(${N})\s+(?:em|no|na|nos|nas|com|de)\s+(.+)$`), "muda $2 para $1");
  sub(new RegExp(String.raw`^(?:o\s+|a\s+)?(.+?)\s+(?:subiu|aumentou|baixou|diminuiu|mudou|passou)\s+(?:para|pra|pro)\s+(${N})$`), "muda $1 para $2");

  // Consultas
  sub(/^(?:to|tô|estou|fiquei|vou ficar|ja estou|ja to)\s+no\s+(?:vermelho|azul|negativo|positivo)$/, "quanto sobra");
  sub(/^(?:quanto|qto|qnto)\s+(?:eu\s+)?(?:ainda\s+)?(?:tenho\s+)?(?:livre|disponivel|sobrando)$/, "quanto sobra");
  sub(/^(?:quanto|qto)\s+(?:da|dá)\s+(?:pra|para)\s+gastar(?:\s+hoje|\s+por dia)?$/, "quanto posso gastar por dia");
  sub(/^(?:como\s+(?:estao|tao|anda|andam|vai|vao|esta|ta)\s+(?:as\s+|os\s+|a\s+|o\s+)?(?:minhas\s+|meus\s+|minha\s+|meu\s+)?(?:contas|financas|gastos|mes|orcamento|planejamento)|balanco(?:\s+do mes)?|situacao(?:\s+do mes)?|panorama(?:\s+do mes)?)$/, "resumo");

  return t.replace(/\s+/g, " ").trim();
}

export type Intent = "add" | "spend" | "income" | "createGroup" | "remove" | "sobra" | "dia" | "resumo" | "maiores";

const BANK: Record<Intent, { keys: RegExp; phrases: string[] }> = {
  add: {
    keys: /\b(adicion\w*|coloc\w*|inclu\w*|planej\w*|item|itens|lanc\w*|cadastr\w*|novo item)\b/,
    phrases: ["adicionar netflix 55", "colocar aluguel 1800 em casa", "novo item academia 120", "planejar mercado 900", "incluir luz 200 na casa"],
  },
  spend: {
    keys: /\b(gast\w*|pag(?:uei|amos|ou|aram)|compr\w*|torrei|saiu|despesa)\b/,
    phrases: ["gastei 50 no mercado", "paguei a luz", "comprei 30 de pao", "torrei 80 no ifood", "uma compra de 35 na farmacia", "despesa de 20 com uber"],
  },
  income: {
    keys: /\b(receb\w*|salario|renda|receita|freela|ganhei|entrou|bonus|pagamento recebido|pix recebido)\b/,
    phrases: ["recebi 800 de freela", "salario de 5000", "entrou 300 de pix", "ganhei 200 de bonus", "renda extra de 400"],
  },
  createGroup: {
    keys: /\b(grupo|grupos|categoria|categorias)\b/,
    phrases: ["criar grupo lazer", "novo grupo viagem", "abrir uma categoria saude", "quero um grupo pets"],
  },
  remove: {
    keys: /\b(apag\w*|exclu\w*|remov\w*|delet\w*|tira\w*)\b/,
    phrases: ["apagar netflix", "excluir o item academia", "remover luz", "tirar o spotify"],
  },
  sobra: {
    keys: /\b(sobr\w*|livre|saldo|resta\w*|vermelho|azul)\b/,
    phrases: ["quanto sobra", "quanto ainda tenho livre", "qual meu saldo do mes", "quanto resta"],
  },
  dia: {
    keys: /\b(por dia|diari\w*|hoje|semana)\b/,
    phrases: ["quanto posso gastar por dia", "quanto da pra gastar hoje", "limite diario"],
  },
  resumo: {
    keys: /\b(resumo|balanco|situacao|panorama|como estou)\b/,
    phrases: ["resumo do mes", "como esta meu mes", "balanco do mes"],
  },
  maiores: {
    keys: /\b(maior\w*|mais gasto|onde gasto|onde mais)\b/,
    phrases: ["meus maiores gastos", "onde estou gastando mais", "onde mais gasto"],
  },
};

function trigrams(s: string): Set<string> {
  const p = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  let hit = 0;
  for (const x of a) if (b.has(x)) hit++;
  return (2 * hit) / (a.size + b.size || 1);
}

/** Tipo de pedido mais provável por palavras-chave e semelhança com frases-modelo; null se não houver confiança. */
export function guessIntent(t: string): Intent | null {
  const shape = t.replace(new RegExp(N, "g"), "50");
  const grams = trigrams(shape);
  const scores = (Object.keys(BANK) as Intent[]).map((intent) => {
    const { keys, phrases } = BANK[intent];
    const sim = Math.max(...phrases.map((p) => dice(grams, trigrams(p))));
    return { intent, score: (keys.test(t) ? 0.6 : 0) + 0.4 * sim };
  }).sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  return best.score >= 0.6 && best.score - second.score >= 0.12 ? best.intent : null;
}

const STOP = new Set([
  "de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "em", "com", "pra", "pro", "para", "o", "a", "os", "as",
  "um", "uma", "uns", "umas", "e", "ai", "que", "meu", "minha", "meus", "minhas", "r$", "valor", "item", "grupo",
  "categoria", "hoje", "ontem", "agora", "la", "aqui", "ja", "tambem", "mais", "eu", "me", "por", "favor", "isso", "esse", "essa",
]);

/** Valor, grupo existente citado e o resto como nome. */
export function extractSlots(t: string, groups: string[], verbs: RegExp): { value: number | null; group: string | null; name: string } {
  const nums = [...t.matchAll(new RegExp(N, "g"))];
  const value = nums.length ? parseNumber(nums[nums.length - 1][0]) : null;
  let rest = t.replace(new RegExp(N, "g"), " ");
  let group: string | null = null;
  for (const g of [...groups].sort((a, b) => b.length - a.length)) {
    const ng = normalize(g);
    const re = new RegExp(String.raw`\b${ng.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\b`);
    if (re.test(rest)) { group = g; rest = rest.replace(re, " "); break; }
  }
  if (!group) {
    const words = rest.split(" ");
    for (const g of groups) {
      const ng = normalize(g);
      const i = words.findIndex((w) => w.length >= 4 && similar(w, ng));
      if (i >= 0 && /^(no|na|em|grupo|categoria)$/.test(words[i - 1] ?? "")) { group = g; words.splice(i, 1); rest = words.join(" "); break; }
    }
  }
  const name = rest
    .replace(verbs, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w) && !/^\W+$/.test(w))
    .join(" ")
    .trim();
  return { value, group, name };
}

export const INTENT_VERBS: Record<"add" | "spend" | "income" | "createGroup" | "remove", RegExp> = {
  add: /\b(adicion\w*|coloc\w*|inclu\w*|planej\w*|lanc\w*|cadastr\w*|nov[oa])\b/g,
  spend: /\b(gast\w*|pag(?:uei|amos|ou|aram)|compr\w*|torrei|saiu|despesa|comprinha)\b/g,
  income: /\b(receb\w*|ganhei|entrou|caiu|renda|receita)\b/g,
  createGroup: /\b(cri\w*|nov[oa]s?|abr\w*|mont\w*|quero|grupos?|categorias?)\b/g,
  remove: /\b(apag\w*|exclu\w*|remov\w*|delet\w*|tira\w*)\b/g,
};
