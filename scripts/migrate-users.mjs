import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Adicionando coluna user_id nas tabelas...");

  const tables = ["credit_cards", "transactions", "investment_accounts", "investments"];

  for (const table of tables) {
    try {
      await sql.query(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id VARCHAR(20) NOT NULL DEFAULT 'italo'`
      );
      console.log(`✓ ${table}`);
    } catch (err) {
      console.error(`✗ ${table}:`, err.message);
    }
  }

  console.log("Migração concluída.");
}

run().catch(console.error);
