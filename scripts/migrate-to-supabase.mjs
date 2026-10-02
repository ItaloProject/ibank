// Copia o esquema public do Neon para o Supabase e confere a contagem de linhas de cada tabela.
// Uso: node scripts/migrate-to-supabase.mjs [--force]
// Lê do .env.local: DATABASE_URL (ou NEON_DATABASE_URL) como origem e SUPABASE_DATABASE_URL como destino.
import nextEnv from "@next/env";
import postgres from "postgres";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

nextEnv.loadEnvConfig(process.cwd());
const source = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
const target = process.env.SUPABASE_DATABASE_URL;
if (!source || !target) throw new Error("Faltam DATABASE_URL e SUPABASE_DATABASE_URL no .env.local");
if (new URL(source).hostname.includes("supabase")) throw new Error("A origem já aponta para o Supabase; defina NEON_DATABASE_URL");

const bin = ["18", "17"].map((v) => `C:\\Program Files\\PostgreSQL\\${v}\\bin`).find((d) => existsSync(join(d, "pg_dump.exe")));
if (!bin) throw new Error("pg_dump não encontrado");

function pgEnv(url, port) {
  const u = new URL(url);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: String(port ?? (u.port || 5432)),
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.slice(1) || "postgres",
    PGSSLMODE: "require",
  };
}

function run(tool, args, env) {
  const r = spawnSync(join(bin, tool), args, { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${tool} falhou: ${r.stderr}`);
  return r.stderr;
}

const from = postgres(source, { max: 1, onnotice: () => {} });
const to = postgres(target, { max: 1, prepare: false, onnotice: () => {} });
const tablesOf = (db) => db`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`.then((r) => r.map((t) => t.tablename));
const count = async (db, t) => Number((await db.unsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`))[0].n);

const existing = await tablesOf(to);
if (existing.length && !process.argv.includes("--force")) {
  throw new Error(`O destino já tem ${existing.length} tabelas (${existing.join(", ")}). Use --force para apagar e copiar de novo.`);
}
if (existing.length) await to.unsafe(existing.map((t) => `DROP TABLE IF EXISTS "${t}" CASCADE;`).join("\n"));

const dump = join(tmpdir(), `muvo-neon-${Date.now()}.sql`);
try {
  console.log("Exportando do Neon...");
  run("pg_dump.exe", ["--schema=public", "--no-owner", "--no-privileges", "--no-publications", "--no-subscriptions", "-f", dump], pgEnv(source));

  // Porta 5432 do pooler é o modo sessão, que aceita tudo o que o pg_dump gera.
  console.log("Importando no Supabase...");
  const log = run("psql.exe", ["-q", "-v", "ON_ERROR_STOP=0", "-f", dump], pgEnv(target, 5432));
  const errors = log.split("\n").filter((l) => /ERROR|ERRO/.test(l) && !/already exists|já existe/.test(l));
  if (errors.length) console.log("Erros na importação:\n" + errors.join("\n"));
} finally {
  rmSync(dump, { force: true });
}

const tables = await tablesOf(from);
await to.unsafe(
  tables.map((t) => `ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`).join("\n") +
    `
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;`,
);

let ok = true;
for (const t of tables) {
  const [a, b] = await Promise.all([count(from, t), count(to, t).catch(() => -1)]);
  if (a !== b) ok = false;
  console.log(`${a === b ? "ok " : "DIFERENTE"} ${t}: Neon ${a}, Supabase ${b}`);
}
console.log(ok ? "\nTudo copiado." : "\nHá diferenças: não troque o DATABASE_URL ainda.");
await Promise.all([from.end(), to.end()]);
