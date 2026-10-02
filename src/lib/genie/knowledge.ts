import { normalize } from "./calc";

/** Palavras que não mudam o sentido da pergunta: "o que é um CDB?" e "o que é CDB" são a mesma. */
const STOP = new Set(`
  o a os as um uma uns umas de do da dos das d em no na nos nas num numa e ou que se
  para pra pro pras pros por pelo pela pelos pelas com sem ao aos à as
  eu me mim meu minha meus minhas voce vc te tu seu sua seus suas nos nosso nossa
  ele ela eles elas isso isto esse essa este esta aquilo
  e eh es sao ser foi era tem ter ha hoje ai la aqui ja ainda tambem mais muito pouco
  qual quais quando onde quem porque pq por que oque
  me explica explique explicar fale fala falar sobre diga dizer sabe saber gostaria queria quero
  genio muvo pesquise pesquisa pesquisar busque buscar procure procurar web internet google
`.trim().split(/\s+/));

/** "Selic" e "selics", "investimentos" e "investimento": mesma palavra. */
const stem = (w: string) => (w.length > 4 ? w.replace(/(?:oes|aes|ais|eis|s)$/, "") : w);

export function knowledgeTokens(question: string): string[] {
  const words = normalize(question).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  return [...new Set(words.filter((w) => !STOP.has(w)).map(stem))].sort();
}

/** Chave da pergunta: as palavras que importam, em ordem alfabética. */
export function knowledgeKey(question: string): string {
  return knowledgeTokens(question).join(" ");
}

function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const set = new Set(b);
  const both = a.filter((w) => set.has(w)).length;
  return both / (a.length + b.length - both);
}

export type KnownAnswer = { id: number; key: string };

/** Pergunta já respondida com as mesmas palavras importantes (ou quase todas). */
export function findKnown<T extends KnownAnswer>(question: string, known: T[], min = 0.8): T | null {
  const tokens = knowledgeTokens(question);
  if (!tokens.length) return null;
  const key = tokens.join(" ");
  const exact = known.find((k) => k.key === key);
  if (exact) return exact;
  let best: T | null = null;
  let score = min;
  for (const k of known) {
    const s = similarity(tokens, k.key.split(" "));
    if (s >= score) { best = k; score = s; }
  }
  return best;
}

/** Respostas que mudam com o tempo (taxas, cotações, "hoje") valem por poucos dias. */
export function isVolatile(question: string): boolean {
  return /\b(?:hoje|agora|atual|atualmente|ultim[oa]s?|recente|cotacao|cota|dolar|euro|bitcoin|selic|cdi|ipca|inflacao|taxa|juros|rendimento|rende|preco|quanto custa|valor do|salario minimo|20\d\d|noticia|amanha|ontem|semana|mes que vem)\b/.test(normalize(question));
}

/**
 * Só perguntas gerais vão para a memória que todos usam:
 * nada com números, e-mail ou telefone, que podem ser dados pessoais.
 */
export function canLearn(question: string): boolean {
  const n = normalize(question);
  if (/\d|@|https?:/.test(n)) return false;
  const tokens = knowledgeTokens(question);
  return tokens.length >= 1 && n.split(" ").length <= 25;
}
