import { FIXED_INCOME_REFERENCE_DATE, TESOURO_CATALOG, type FixedIncomeEntry } from "@/lib/fixed-income-catalog";

/** Taxas de compra do dia publicadas pelo Tesouro, por id do catálogo. */
export type TesouroLive = {
  /** Data das taxas, dd/mm/aaaa. */
  date: string;
  rates: Record<string, number>;
};

/** "Tesouro Renda+ Aposentadoria Extra" e "Tesouro Renda+ 2030" viram a mesma família. */
function family(name: string): string {
  return name
    .replace(/\s+\d{4}$/, "")
    .replace(/Aposentadoria Extra/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** dd/mm/aaaa → aaaa-mm-dd */
function iso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

/**
 * Lê o CSV "Preço e Taxa do Tesouro Direto" (Tesouro Transparente), que traz o histórico inteiro,
 * e devolve só as taxas de compra da data mais recente dos títulos à venda que estão no catálogo.
 */
export function parseTesouroCsv(csv: string, catalog: FixedIncomeEntry[] = TESOURO_CATALOG): TesouroLive | null {
  let best = "";
  let bestBr = "";
  let rows = new Map<string, number>();

  for (const line of csv.split(/\r?\n/)) {
    const f = line.split(";");
    if (f.length < 6) continue;
    const day = iso(f[2]);
    if (!day || day < best) continue;
    const maturity = iso(f[1]);
    const taxa = num(f[3]);
    const pu = num(f[5]);
    if (!maturity || !Number.isFinite(taxa) || !(pu > 0)) continue;
    if (day > best) {
      best = day;
      bestBr = f[2];
      rows = new Map();
    }
    rows.set(`${family(f[0])}|${maturity}`, taxa);
  }
  if (!best) return null;

  const rates: Record<string, number> = {};
  for (const e of catalog) {
    if (!e.maturity) continue;
    const taxa = rows.get(`${family(e.nome)}|${e.maturity}`);
    if (taxa !== undefined) rates[e.id] = taxa;
  }
  return Object.keys(rates).length ? { date: bestBr, rates } : null;
}

const brToIso = (br: string) => iso(br) ?? "";

/** Usa as taxas do dia só se forem mais novas que as do catálogo fixo. */
export function isFresher(live: TesouroLive | null): live is TesouroLive {
  return !!live && brToIso(live.date) >= brToIso(FIXED_INCOME_REFERENCE_DATE);
}

/** Catálogo do Tesouro com as taxas do dia quando disponíveis. */
export function tesouroCatalog(live: TesouroLive | null): { catalog: FixedIncomeEntry[]; date: string } {
  if (!isFresher(live)) return { catalog: TESOURO_CATALOG, date: FIXED_INCOME_REFERENCE_DATE };
  return {
    catalog: TESOURO_CATALOG.map((e) => (e.id in live.rates ? { ...e, rate_value: live.rates[e.id] } : e)),
    date: live.date,
  };
}
