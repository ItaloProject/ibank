import sql from "@/lib/db";
import type { LearnedPhrase } from "@/lib/genie/learn";

export const MAX_PHRASES = 200;
const MAX_LEN = 300;

let ensured = false;

/** Frases que o MUVO Gênio aprendeu com cada pessoa, uma tabela criada uma vez por processo. */
async function ensureGeniePhrasesTable() {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS genie_phrases (
      user_id VARCHAR(20) NOT NULL,
      phrase VARCHAR(300) NOT NULL,
      rewrite VARCHAR(300) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, phrase)
    )
  `;
  ensured = true;
}

export async function listPhrases(userId: string): Promise<LearnedPhrase[]> {
  await ensureGeniePhrasesTable();
  const rows = await sql`
    SELECT phrase, rewrite FROM genie_phrases WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT ${MAX_PHRASES}
  `;
  return rows.map((r) => ({ phrase: String(r.phrase), rewrite: String(r.rewrite) }));
}

export function parsePhrase(body: unknown): LearnedPhrase | null {
  const { phrase, rewrite } = (body ?? {}) as { phrase?: unknown; rewrite?: unknown };
  if (typeof phrase !== "string" || typeof rewrite !== "string") return null;
  const p = phrase.trim().slice(0, MAX_LEN);
  const r = rewrite.trim().slice(0, MAX_LEN);
  return p && r && p !== r ? { phrase: p, rewrite: r } : null;
}

export async function savePhrase(userId: string, l: LearnedPhrase) {
  await ensureGeniePhrasesTable();
  await sql`
    INSERT INTO genie_phrases (user_id, phrase, rewrite) VALUES (${userId}, ${l.phrase}, ${l.rewrite})
    ON CONFLICT (user_id, phrase) DO UPDATE SET rewrite = EXCLUDED.rewrite, created_at = now()
  `;
  await sql`
    DELETE FROM genie_phrases WHERE user_id = ${userId} AND phrase NOT IN (
      SELECT phrase FROM genie_phrases WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${MAX_PHRASES}
    )
  `;
}

export async function deletePhrase(userId: string, phrase: string) {
  await ensureGeniePhrasesTable();
  await sql`DELETE FROM genie_phrases WHERE user_id = ${userId} AND phrase = ${phrase}`;
}
