import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS cash_flows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(20) NOT NULL,
      month VARCHAR(7) NOT NULL,
      description VARCHAR(200) NOT NULL,
      type VARCHAR(10) NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(20) NOT NULL,
      month VARCHAR(7) NOT NULL,
      goal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      UNIQUE(user_id, month)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cash_flows_user_month ON cash_flows(user_id, month)
  `;
  console.log("Tabelas cash_flows e savings_goals criadas com sucesso.");
}

migrate().catch(console.error);
