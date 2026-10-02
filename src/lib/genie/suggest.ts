import { normalize } from "./calc";

const STARTERS = [
  "adicionar ",
  "gastei ",
  "paguei ",
  "criar grupo ",
  "recebi ",
  "quanto sobra?",
  "quanto posso gastar por dia?",
  "quanto gastei em ",
  "muda ",
  "apagar ",
  "resumo do mês",
];

export type Suggestion = { label: string; value: string };

/**
 * Sugestões enquanto a pessoa digita: o começo de um pedido na primeira palavra
 * e, depois, nomes de itens e grupos que completam a palavra em andamento.
 */
export function suggest(input: string, names: string[], max = 4): Suggestion[] {
  if (!input.trim() || /\s$/.test(input) && input.trim().split(" ").length > 1) return [];
  const words = input.split(" ");
  const partial = words[words.length - 1];
  const p = normalize(partial);
  if (p.length < 2 || /\d/.test(p)) return [];
  const head = input.slice(0, input.length - partial.length);

  if (words.length === 1) {
    return STARTERS
      .filter((s) => normalize(s).startsWith(p) && normalize(s).trim() !== p)
      .slice(0, max)
      .map((s) => ({ label: s.trim(), value: s }));
  }

  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const name of names) {
    const n = normalize(name);
    if (seen.has(n) || n === p) continue;
    if (n.startsWith(p) || n.split(" ").some((w) => w.startsWith(p) && w !== p)) {
      seen.add(n);
      out.push({ label: name, value: `${head}${name} ` });
      if (out.length >= max) break;
    }
  }
  return out;
}
