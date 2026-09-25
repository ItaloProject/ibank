/**
 * Curva mensal de Selic, CDI e IPCA para projeções.
 *
 * Selic: parte da meta de hoje e passa, em linha reta, pela mediana do Boletim
 * Focus para o fim de cada ano; depois do último ano projetado, fica estável.
 * Sem Focus, converge em 3 anos ao juro neutro (IPCA + NEUTRAL_REAL_RATE).
 * CDI: Selic menos a diferença observada hoje entre as duas.
 * IPCA: projeção do Focus para o ano de cada mês; fora dela, o último valor.
 */
import type { FocusExpectations } from "@/lib/market-research";

/** Juro real neutro estimado pelo Banco Central (% a.a.). */
export const NEUTRAL_REAL_RATE = 5;

export type MarketInputs = {
  selic: number;
  cdi: number;
  ipca12m: number;
  focus?: FocusExpectations;
};

export type Curve = {
  /** % a.a. vigente em cada mês (índice 0 = mês atual). */
  selic: number[];
  cdi: number[];
  ipca: number[];
  source: "focus" | "neutro";
};

export function neutralRate(ipca: number): number {
  return ((1 + ipca / 100) * (1 + NEUTRAL_REAL_RATE / 100) - 1) * 100;
}

export function buildCurve(m: MarketInputs, months: number, start: Date = new Date()): Curve {
  const y0 = start.getFullYear();
  const mo0 = start.getMonth();
  const spread = Math.max(0, m.selic - m.cdi);

  const focusIpca = (m.focus?.ipca ?? []).filter((f) => Number.isFinite(f.valor));
  const ipcaByYear = new Map(focusIpca.map((f) => [f.ano, f.valor]));
  const lastIpca = focusIpca.length ? focusIpca[focusIpca.length - 1] : null;
  const ipcaOf = (year: number) =>
    ipcaByYear.get(year) ?? (lastIpca && year > lastIpca.ano ? lastIpca.valor : m.ipca12m);

  const anchors: [number, number][] = [[0, m.selic]];
  for (const f of m.focus?.selic ?? []) {
    const idx = (f.ano - y0) * 12 + (11 - mo0);
    if (idx > 0 && Number.isFinite(f.valor)) anchors.push([idx, f.valor]);
  }
  let source: Curve["source"] = "focus";
  if (anchors.length === 1) {
    source = "neutro";
    const longIpca = lastIpca?.valor ?? m.ipca12m;
    anchors.push([36, neutralRate(longIpca) + spread]);
  }
  anchors.sort((a, b) => a[0] - b[0]);

  const selicAt = (t: number) => {
    for (let i = 1; i < anchors.length; i++) {
      const [t1, v1] = anchors[i];
      if (t <= t1) {
        const [t0, v0] = anchors[i - 1];
        return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
      }
    }
    return anchors[anchors.length - 1][1];
  };

  const n = Math.max(1, months);
  const selic = new Array<number>(n);
  const cdi = new Array<number>(n);
  const ipca = new Array<number>(n);
  for (let t = 0; t < n; t++) {
    selic[t] = selicAt(t);
    cdi[t] = Math.max(0, selic[t] - spread);
    ipca[t] = ipcaOf(y0 + Math.floor((mo0 + t) / 12));
  }
  return { selic, cdi, ipca, source };
}
