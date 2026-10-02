/**
 * Calculadora do Muvo Gênio: números no formato brasileiro, porcentagem e operações por extenso,
 * sem eval. "15% de 3000" = 450; "3000 + 10%" = 3300; "1.500,50 x 2" = 3001.
 */

export function normalize(raw: string): string {
  return raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

/** "1.500,50" → 1500.5; "1500.5" → 1500.5; "2.000" → 2000; "5k" e "5 mil" → 5000. */
export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/^r\$\s*/i, "").replace(/\s+/g, "");
  let mult = 1;
  const suf = s.match(/(k|mil)$/i);
  if (suf) {
    mult = 1000;
    s = s.slice(0, -suf[1].length);
  }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : null;
}

export const NUMBER_RE = String.raw`(?:r\$\s*)?\d[\d.,]*(?:\s?(?:k|mil)\b)?`;

type Tok = { t: "num"; v: number; pct: boolean } | { t: "op"; v: string } | { t: "(" } | { t: ")" };

const WORD_OPS: [RegExp, string][] = [
  [/\bdividido por\b/g, "/"],
  [/\bmultiplicado por\b/g, "*"],
  [/\bvezes\b/g, "*"],
  [/\bmais\b/g, "+"],
  [/\bmenos\b/g, "-"],
  [/\belevado a\b/g, "^"],
  [/([\d)%])\s*x\s*(?=[\d(r])/g, "$1*"],
  [/[×]/g, "*"],
  [/[÷]/g, "/"],
  [/%\s*(?:de|do|da|dos|das|sobre)\b/g, "% *"],
];

function tokenize(expr: string): Tok[] | null {
  let s = expr;
  for (const [re, rep] of WORD_OPS) s = s.replace(re, rep);
  const out: Tok[] = [];
  const re = new RegExp(String.raw`\s*(?:(${NUMBER_RE})\s*(%)?|([+\-*/^])|(\()|(\)))`, "y");
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) return null;
    if (m[1]) {
      const v = parseNumber(m[1]);
      if (v === null) return null;
      out.push({ t: "num", v, pct: !!m[2] });
    } else if (m[3]) out.push({ t: "op", v: m[3] });
    else if (m[4]) out.push({ t: "(" });
    else out.push({ t: ")" });
    i = re.lastIndex;
  }
  return out.length ? out : null;
}

type Val = { v: number; pct: boolean };

/** Avalia a expressão; null se não for uma conta válida. */
export function evaluate(expr: string): number | null {
  const toks = tokenize(normalize(expr));
  if (!toks) return null;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = peek(); return t?.t === "op" && t.v === v; };

  function primary(): Val | null {
    const t = peek();
    if (!t) return null;
    if (t.t === "op" && t.v === "-") { p++; const x = primary(); return x && { v: -x.v, pct: x.pct }; }
    if (t.t === "op" && t.v === "+") { p++; return primary(); }
    if (t.t === "num") { p++; return { v: t.v, pct: t.pct }; }
    if (t.t === "(") {
      p++;
      const x = additive();
      if (!x || peek()?.t !== ")") return null;
      p++;
      return { v: x.v, pct: false };
    }
    return null;
  }
  function power(): Val | null {
    const base = primary();
    if (!base) return null;
    if (isOp("^")) { p++; const e = power(); return e && { v: Math.pow(asNumber(base), asNumber(e)), pct: false }; }
    return base;
  }
  function asNumber(x: Val) { return x.pct ? x.v / 100 : x.v; }
  function multiplicative(): Val | null {
    let left = power();
    while (left && (isOp("*") || isOp("/"))) {
      const op = (peek() as { v: string }).v;
      p++;
      const right = power();
      if (!right) return null;
      const r = asNumber(right);
      left = { v: op === "*" ? asNumber(left) * r : r === 0 ? NaN : asNumber(left) / r, pct: false };
    }
    return left;
  }
  function additive(): Val | null {
    let left = multiplicative();
    while (left && (isOp("+") || isOp("-"))) {
      const op = (peek() as { v: string }).v;
      p++;
      const right = multiplicative();
      if (!right) return null;
      const base = asNumber(left);
      const r = right.pct ? (base * right.v) / 100 : right.v;
      left = { v: op === "+" ? base + r : base - r, pct: false };
    }
    return left;
  }

  const result = additive();
  if (!result || p !== toks.length) return null;
  const v = asNumber(result);
  return Number.isFinite(v) ? Math.round(v * 1e8) / 1e8 : null;
}

/** Tem cara de conta: só números, operadores, porcentagem e palavras de operação. */
export function looksLikeMath(raw: string): boolean {
  const s = normalize(raw)
    .replace(/^(quanto (e|da|fica|sao)|calcul[ae]r?|conta|resultado de)\s*:?\s*/, "")
    .replace(/[?=]\s*$/, "");
  if (!/\d/.test(s)) return false;
  const stripped = s.replace(/\b(dividido por|multiplicado por|vezes|mais|menos|elevado a|de|do|da|dos|das|sobre|x|k|mil|r\$)\b/g, " ");
  return /^[\d\s.,+\-*/^()%×÷r$]+$/.test(stripped) && /[+\-*/^%×÷]|\b(vezes|mais|menos|dividido|multiplicado|elevado|x)\b/.test(s);
}

const OP = String.raw`(?:[+*/^×÷x]|-(?=\s*(?:r\$\s*)?\d)|\bmais\b|\bmenos\b|\bvezes\b|\bdividido por\b|\bmultiplicado por\b)`;

/** Resolve contas no meio de um pedido: "adicionar 1,19 + 34,01 de railway" → "adicionar 35,20 de railway". */
export function foldMath(text: string): { text: string; exprs: { expr: string; value: number }[] } {
  const exprs: { expr: string; value: number }[] = [];
  const re = new RegExp(String.raw`${NUMBER_RE}%?(?:\s*${OP}\s*${NUMBER_RE}%?)+`, "g");
  const out = text.replace(re, (m) => {
    const v = evaluate(m);
    if (v === null || v < 0) return m;
    const value = Math.round(v * 100) / 100;
    exprs.push({ expr: m.trim(), value });
    return value.toFixed(2).replace(".", ",");
  });
  return { text: out, exprs };
}

export function mathBody(raw: string): string {
  return normalize(raw)
    .replace(/^(quanto (e|da|fica|sao)|calcul[ae]r?|conta|resultado de)\s*:?\s*/, "")
    .replace(/[?=]\s*$/, "");
}
