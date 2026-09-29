import type { RateIndex } from "@/lib/account-rate";
import { tesouroCatalog, type TesouroLive } from "@/lib/tesouro-rates";

export type RateHint = {
  index?: RateIndex;
  /** Só o tipo do produto sugere o indexador (ex.: "CDB"): vale apenas se nada foi escolhido. */
  weakIndex?: boolean;
  value?: number;
  maturity?: string;
  /** Só o ano veio no nome: o dia é uma aproximação. */
  maturityApprox?: boolean;
  /** Explicação curta para o usuário. */
  fonte: string;
};

function plain(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function num(raw: string): number {
  return raw.includes(",") ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Dia de vencimento de cada família do Tesouro quando o título não está no catálogo. */
function tesouroMaturity(t: string, year: number): string | null {
  if (/renda\s*\+|renda mais/.test(t)) return `${year + 19}-12-15`;
  if (/educa\s*\+|educa mais/.test(t)) return `${year + 4}-12-15`;
  if (/selic/.test(t)) return `${year}-03-01`;
  if (/ipca|inflacao/.test(t)) return /semestra/.test(t) ? `${year}-05-15` : `${year}-08-15`;
  if (/prefixado|reserva/.test(t)) return `${year}-01-01`;
  return null;
}

/**
 * Lê no nome da aplicação o que der para preencher: indexador, taxa e vencimento.
 * Ex.: "Tesouro IPCA+ 2035", "CDB 110% do CDI 2028", "LCA IPCA + 6,5% 15/05/2030".
 */
export function rateHintFromName(name: string, live: TesouroLive | null = null): RateHint | null {
  const t = plain(name).trim();
  if (t.length < 3) return null;
  const hint: RateHint = { fonte: "" };
  const isTesouro = /tesouro/.test(t);

  const tesouro = isTesouro ? tesouroCatalog(live) : null;
  const catalog = tesouro
    ? [...tesouro.catalog].sort((a, b) => b.nome.length - a.nome.length).find((e) => t.includes(plain(e.nome)))
    : undefined;
  if (tesouro && catalog) {
    return {
      index: catalog.rate_index,
      value: catalog.rate_value,
      maturity: catalog.maturity ?? undefined,
      fonte: `${catalog.nome}, com a taxa de compra de ${tesouro.date}`,
    };
  }

  const ipca = t.match(/(?:ipca|inflacao)\s*\+\s*([\d.,]+)\s*%?/);
  const selicPlus = t.match(/selic\s*\+\s*([\d.,]+)\s*%?/);
  const cdi = t.match(/([\d.,]+)\s*%\s*(?:do\s+)?cdi/);
  const pre = t.match(/([\d.,]+)\s*%\s*(?:a\.?\s*a\.?|ao ano)/);

  if (ipca) Object.assign(hint, { index: "ipca", value: num(ipca[1]) });
  else if (selicPlus) Object.assign(hint, { index: "selic", value: num(selicPlus[1]) });
  else if (cdi) Object.assign(hint, { index: "cdi", value: num(cdi[1]) });
  else if (pre) Object.assign(hint, { index: "pre", value: num(pre[1]) });
  else if (/poupanca/.test(t)) hint.index = "poupanca";
  else if (/ipca|inflacao|renda\s*\+|educa\s*\+/.test(t)) hint.index = "ipca";
  else if (/selic/.test(t)) hint.index = "selic";
  else if (/prefixad/.test(t)) hint.index = "pre";
  else if (/\bcdi\b|\b(cdb|rdb|rdc|lci|lca|lc|lig)s?\b/.test(t)) Object.assign(hint, { index: "cdi", weakIndex: !/\bcdi\b/.test(t) });

  if (hint.value !== undefined && !Number.isFinite(hint.value)) delete hint.value;

  if (hint.index !== "poupanca") {
    const full = t.match(/\b(\d{1,2})\/(\d{1,2})\/(20[2-9]\d)\b/);
    const monthYear = t.match(/\b(\d{1,2})\/(20[2-9]\d)\b/);
    const year = t.match(/\b(20[2-9]\d)\b/);
    if (full && +full[2] >= 1 && +full[2] <= 12 && +full[1] >= 1 && +full[1] <= 31) {
      hint.maturity = `${full[3]}-${pad(+full[2])}-${pad(+full[1])}`;
    } else if (monthYear && +monthYear[1] >= 1 && +monthYear[1] <= 12) {
      hint.maturity = `${monthYear[2]}-${pad(+monthYear[1])}-01`;
      hint.maturityApprox = true;
    } else if (year) {
      const y = +year[1];
      const exact = isTesouro ? tesouroMaturity(t, y) : null;
      hint.maturity = exact ?? `${y}-01-01`;
      hint.maturityApprox = !exact;
    }
  }

  if (!hint.index && !hint.maturity) return null;
  const parts = [
    hint.index && !hint.weakIndex ? "indexador" : null,
    hint.value !== undefined ? "taxa" : null,
    hint.maturity ? "vencimento" : null,
  ].filter(Boolean);
  hint.fonte = parts.length ? parts.join(", ").replace(/, ([^,]*)$/, " e $1") : "tipo do produto";
  return hint;
}
