import sql from "@/lib/db";
import { findKnown, isVolatile, knowledgeKey } from "@/lib/genie/knowledge";

export type Source = { title: string; url: string };
export type Knowledge = { id: number; key: string; question: string; answer: string; sources: Source[] };

const MAX_ROWS = 5000;
const CACHE_MS = 5 * 60 * 1000;

let ensured: Promise<void> | null = null;
let cache: { at: number; rows: Knowledge[] } | null = null;

/** O que o Muvo Gênio aprendeu com as pesquisas na web, compartilhado entre todos: só perguntas gerais, sem dados pessoais. */
function ensureTable(): Promise<void> {
  ensured ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS genie_knowledge (
        id BIGSERIAL PRIMARY KEY,
        key VARCHAR(400) NOT NULL UNIQUE,
        question VARCHAR(400) NOT NULL,
        answer TEXT NOT NULL,
        sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        volatile BOOLEAN NOT NULL DEFAULT false,
        hits INT NOT NULL DEFAULT 0,
        ups INT NOT NULL DEFAULT 0,
        downs INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}

/** Respostas de "hoje", taxas e cotações valem 7 dias; depois são pesquisadas de novo. */
async function usable(): Promise<Knowledge[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  await ensureTable();
  const rows = await sql`
    SELECT id, key, question, answer, sources FROM genie_knowledge
    WHERE downs <= ups AND (NOT volatile OR updated_at > now() - INTERVAL '7 days')
    ORDER BY hits DESC, updated_at DESC LIMIT ${MAX_ROWS}
  `;
  cache = {
    at: Date.now(),
    rows: rows.map((r) => ({
      id: Number(r.id),
      key: String(r.key),
      question: String(r.question),
      answer: String(r.answer),
      sources: Array.isArray(r.sources) ? (r.sources as Source[]) : [],
    })),
  };
  return cache.rows;
}

/** Resposta já aprendida para a pergunta, sem gastar pesquisa. */
export async function recall(question: string): Promise<Knowledge | null> {
  const hit = findKnown(question, await usable());
  if (hit) await sql`UPDATE genie_knowledge SET hits = hits + 1 WHERE id = ${hit.id}`;
  return hit;
}

/** Guarda a resposta da web; uma pergunta repetida substitui a antiga e zera os votos. */
export async function learnAnswer(question: string, answer: string, sources: Source[]): Promise<number | null> {
  const key = knowledgeKey(question);
  if (!key) return null;
  await ensureTable();
  const rows = await sql`
    INSERT INTO genie_knowledge (key, question, answer, sources, volatile)
    VALUES (${key}, ${question}, ${answer}, ${JSON.stringify(sources)}::jsonb, ${isVolatile(question)})
    ON CONFLICT (key) DO UPDATE SET
      question = EXCLUDED.question, answer = EXCLUDED.answer, sources = EXCLUDED.sources,
      volatile = EXCLUDED.volatile, ups = 0, downs = 0, updated_at = now()
    RETURNING id
  `;
  cache = null;
  return rows[0] ? Number(rows[0].id) : null;
}

/** "Ajudou" ou "Não ajudou": respostas com mais votos contra do que a favor deixam de ser usadas. */
export async function voteAnswer(id: number, vote: "up" | "down"): Promise<void> {
  await ensureTable();
  if (vote === "up") await sql`UPDATE genie_knowledge SET ups = ups + 1 WHERE id = ${id}`;
  else await sql`UPDATE genie_knowledge SET downs = downs + 1 WHERE id = ${id}`;
  cache = null;
}
