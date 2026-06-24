import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS plan_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(20) NOT NULL,
      name VARCHAR(100) NOT NULL,
      color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS plan_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID NOT NULL,
      user_id VARCHAR(20) NOT NULL,
      month VARCHAR(7) NOT NULL,
      name VARCHAR(200) NOT NULL,
      type VARCHAR(10) NOT NULL DEFAULT 'fixo',
      planned NUMERIC(12,2) NOT NULL DEFAULT 0,
      actual NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log("Tabelas plan_groups e plan_items criadas com sucesso.");
}

migrate().catch(console.error);
