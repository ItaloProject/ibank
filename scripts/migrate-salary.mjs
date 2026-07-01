import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS plan_salary (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(20) NOT NULL,
      month VARCHAR(7) NOT NULL,
      salary NUMERIC(12,2) NOT NULL DEFAULT 0,
      UNIQUE(user_id, month)
    )
  `;
  console.log("Tabela plan_salary criada com sucesso.");
}

migrate().catch(console.error);
