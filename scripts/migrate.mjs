// Aplica supabase/schema.sql no banco apontado por DATABASE_URL.
// Uso: DATABASE_URL="postgresql://..." node scripts/migrate.mjs
// A URL do banco nunca fica no código: ela vem do ambiente (veja .env.example).
import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Defina DATABASE_URL no ambiente antes de rodar a migração.");
  process.exit(1);
}

// prepare:false porque o pooler do Supabase em modo transação não guarda comandos preparados.
const sql = postgres(DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
const schema = readFileSync(join(__dirname, "../supabase/schema.sql"), "utf-8");

const stripped = schema
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

const statements = stripped
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  try {
    await sql.unsafe(stmt);
    console.log("✓", stmt.slice(0, 70).replace(/\n/g, " ").trim());
  } catch (err) {
    console.error("✗", stmt.slice(0, 70).replace(/\n/g, " ").trim());
    console.error("  →", err.message);
  }
}

await sql.end();
