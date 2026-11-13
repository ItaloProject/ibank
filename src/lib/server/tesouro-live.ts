import sql from "@/lib/db";
import { parseTesouroCsv, type TesouroLive } from "@/lib/tesouro-rates";

const CSV_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";

/** Taxas guardadas no banco valem até a próxima atualização agendada (cron de dias úteis). */
const TTL_MS = 6 * 60 * 60 * 1000;
/** Se o download falhar, tenta de novo depois deste intervalo em vez de bater no governo a cada pedido. */
const RETRY_MS = 30 * 60 * 1000;

let memo: { at: number; data: TesouroLive | null } | null = null;
let inflight: Promise<TesouroLive | null> | null = null;
let ensured: Promise<void> | null = null;

/** Uma linha só (id = 1): a data das taxas e o mapa de taxas por id do catálogo. */
function ensureTable(): Promise<void> {
  ensured ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS tesouro_taxas (
        id INT PRIMARY KEY,
        data_ref TEXT NOT NULL,
        rates JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}

async function lerBanco(): Promise<{ data: TesouroLive; updatedAt: number } | null> {
  await ensureTable();
  const rows = await sql`SELECT data_ref, rates, updated_at FROM tesouro_taxas WHERE id = 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    data: { date: String(r.data_ref), rates: r.rates as Record<string, number> },
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

async function gravarBanco(data: TesouroLive): Promise<void> {
  await ensureTable();
  await sql`
    INSERT INTO tesouro_taxas (id, data_ref, rates)
    VALUES (1, ${data.date}, ${sql.json(data.rates)})
    ON CONFLICT (id) DO UPDATE SET data_ref = EXCLUDED.data_ref, rates = EXCLUDED.rates, updated_at = now()
  `;
}

/**
 * Baixa o CSV oficial (mais de 14 MB, histórico desde 2002), lê as taxas do dia e grava no banco.
 * Usado pelo cron agendado. Devolve null se o download ou a leitura falhar.
 */
export async function atualizarTesouro(): Promise<TesouroLive | null> {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store", signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = parseTesouroCsv(await res.text());
    if (!data) return null;
    await gravarBanco(data);
    memo = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.error("[tesouro-live] atualização", err);
    return null;
  }
}

async function carregar(): Promise<TesouroLive | null> {
  // 1) Banco: leitura rápida, sem baixar nada. Vale se foi atualizado dentro do prazo.
  try {
    const banco = await lerBanco();
    if (banco && Date.now() - banco.updatedAt < TTL_MS) {
      memo = { at: Date.now(), data: banco.data };
      return banco.data;
    }
  } catch (err) {
    console.error("[tesouro-live] leitura do banco", err);
  }

  // 2) Banco vencido ou vazio: tenta baixar agora (caso o cron tenha falhado).
  const novo = await atualizarTesouro();
  if (novo) return novo;

  // 3) Download falhou: usa o último valor guardado, mesmo antigo, e tenta de novo mais tarde.
  let antigo: TesouroLive | null = null;
  try {
    antigo = (await lerBanco())?.data ?? null;
  } catch {
    antigo = null;
  }
  memo = { at: Date.now() - (TTL_MS - RETRY_MS), data: antigo };
  return antigo;
}

/** Taxas do dia. Lê do banco; só baixa o arquivo oficial se o banco estiver vencido ou vazio. */
export async function getTesouroLive(): Promise<TesouroLive | null> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.data;
  inflight ??= carregar().finally(() => {
    inflight = null;
  });
  return inflight;
}
