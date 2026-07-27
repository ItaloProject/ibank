import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS stock_trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(20) NOT NULL,
      ticker VARCHAR(10) NOT NULL,
      type VARCHAR(10) NOT NULL DEFAULT 'compra',
      quantity NUMERIC(14,4) NOT NULL,
      price_per_share NUMERIC(12,4) NOT NULL,
      total_amount NUMERIC(12,2) NOT NULL,
      notes VARCHAR(200) DEFAULT '',
      date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_stock_trades_user ON stock_trades(user_id)
  `;
  console.log("Tabela stock_trades criada com sucesso.");
}

migrate().catch(console.error);
