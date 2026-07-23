import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`
    ALTER TABLE savings_goals
    ADD COLUMN IF NOT EXISTS saved_amount NUMERIC(12,2) NOT NULL DEFAULT 0
  `;
  console.log("Coluna saved_amount adicionada em savings_goals.");
}

migrate().catch(console.error);
