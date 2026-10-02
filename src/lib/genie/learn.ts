import { NUMBER_RE, normalize } from "./calc";

/** Frase aprendida: "botei {0} na budega" → "gastei {0} no mercado". */
export type LearnedPhrase = { phrase: string; rewrite: string };

const NUM = new RegExp(NUMBER_RE, "g");
const clean = (s: string) => normalize(s).replace(/[?!.]+$/, "").trim();

/** Trocas os números que aparecem nas duas frases por lacunas numeradas. */
export function toTemplate(miss: string, rewrite: string): LearnedPhrase | null {
  const m = clean(miss);
  const r = rewrite.replace(/[?!.]+$/, "").trim();
  if (!m || !r || m === clean(r)) return null;
  const missNums = [...m.matchAll(NUM)].map((x) => x[0]);
  let phrase = m;
  let out = r;
  missNums.forEach((n, i) => {
    phrase = phrase.replace(n, `{${i}}`);
    const at = normalize(out).indexOf(n);
    if (at >= 0) out = out.slice(0, at) + `{${i}}` + out.slice(at + n.length);
  });
  return { phrase, rewrite: out };
}

function trigrams(s: string): Set<string> {
  const p = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  return out;
}

/** A segunda frase parece reformular a primeira: mesmo número ou bastante texto em comum. */
export function looksLikeRephrase(miss: string, rewrite: string): boolean {
  const a = clean(miss);
  const b = clean(rewrite);
  const na = new Set([...a.matchAll(NUM)].map((x) => x[0]));
  if ([...b.matchAll(NUM)].some((x) => na.has(x[0]))) return true;
  const ga = trigrams(a.replace(NUM, ""));
  const gb = trigrams(b.replace(NUM, ""));
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit++;
  return (2 * hit) / (ga.size + gb.size || 1) >= 0.35;
}

/** Aplica uma frase aprendida ao que a pessoa digitou; null se nenhuma servir. */
export function applyLearned(text: string, learned: LearnedPhrase[]): string | null {
  const t = clean(text);
  const nums = [...t.matchAll(NUM)].map((x) => x[0]);
  let i = 0;
  const shape = t.replace(NUM, () => `{${i++}}`);
  const hit = learned.find((l) => l.phrase === shape);
  if (!hit) return null;
  return hit.rewrite.replace(/\{(\d+)\}/g, (_, k: string) => nums[Number(k)] ?? "");
}
