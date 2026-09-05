import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(7)`;
  console.log("Coluna billing_cycle adicionada a transactions.");
}

migrate().catch(console.error);
