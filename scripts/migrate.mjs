import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL =
  "postgresql://neondb_owner:npg_5RzdIjDYqy6m@ep-plain-surf-aciln5bl.sa-east-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);
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
    await sql.query(stmt);
    console.log("✓", stmt.slice(0, 70).replace(/\n/g, " ").trim());
  } catch (err) {
    console.error("✗", stmt.slice(0, 70).replace(/\n/g, " ").trim());
    console.error("  →", err.message);
  }
}

console.log("\nMigração concluída!");
