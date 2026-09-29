import { parseTesouroCsv, type TesouroLive } from "@/lib/tesouro-rates";

const CSV_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";

const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 30 * 60 * 1000;

let cached: { at: number; ok: boolean; data: TesouroLive | null } | null = null;
let inflight: Promise<TesouroLive | null> | null = null;

async function load(): Promise<TesouroLive | null> {
  try {
    // O arquivo tem mais de 14 MB (histórico desde 2002): acima do limite do cache de fetch do Next.
    const res = await fetch(CSV_URL, { cache: "no-store", signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = parseTesouroCsv(await res.text());
    cached = { at: Date.now(), ok: !!data, data: data ?? cached?.data ?? null };
  } catch (err) {
    console.error("[tesouro-live]", err);
    cached = { at: Date.now(), ok: false, data: cached?.data ?? null };
  } finally {
    inflight = null;
  }
  return cached.data;
}

function expired(): boolean {
  return !cached || Date.now() - cached.at > (cached.ok ? TTL_MS : RETRY_MS);
}

/** Taxas do dia; espera o download quando o cache está vazio ou vencido. */
export async function getTesouroLive(): Promise<TesouroLive | null> {
  if (!expired()) return cached!.data;
  inflight ??= load();
  return inflight;
}

/** Não espera: devolve o que houver em cache e atualiza em segundo plano. */
export function peekTesouroLive(): TesouroLive | null {
  if (expired()) inflight ??= load();
  return cached?.data ?? null;
}
