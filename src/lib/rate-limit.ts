import sql from "@/lib/db";

/*
 * Limite de chamadas por janela de tempo (ex.: 40 consultas por minuto por usuário).
 * O contador fica no banco, porque a Vercel roda várias instâncias ao mesmo tempo.
 */

export type Limite = { chave: string; max: number; janelaSeg: number };

/** Segundos até a janela atual acabar (pelo menos 1). */
export function segundosAteReiniciar(inicio: Date, janelaSeg: number, agora: Date): number {
  return Math.max(1, Math.ceil((inicio.getTime() + janelaSeg * 1000 - agora.getTime()) / 1000));
}

let tabelaPronta = false;
async function garantirTabela() {
  if (tabelaPronta) return;
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      chave TEXT PRIMARY KEY,
      inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      contagem INTEGER NOT NULL DEFAULT 0
    )
  `;
  tabelaPronta = true;
}

/** Conta uma chamada. Devolve { ok: false, retryAfter } quando passou do máximo da janela. */
export async function limitar(l: Limite): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  await garantirTabela();
  const rows = await sql`
    INSERT INTO rate_limits (chave, inicio, contagem) VALUES (${l.chave}, NOW(), 1)
    ON CONFLICT (chave) DO UPDATE SET
      contagem = CASE WHEN rate_limits.inicio < NOW() - (${l.janelaSeg}::int * interval '1 second') THEN 1 ELSE rate_limits.contagem + 1 END,
      inicio = CASE WHEN rate_limits.inicio < NOW() - (${l.janelaSeg}::int * interval '1 second') THEN NOW() ELSE rate_limits.inicio END
    RETURNING contagem, inicio
  `;
  const { contagem, inicio } = rows[0] as { contagem: number; inicio: string | Date };
  if (contagem <= l.max) return { ok: true };
  return { ok: false, retryAfter: segundosAteReiniciar(new Date(inicio), l.janelaSeg, new Date()) };
}
