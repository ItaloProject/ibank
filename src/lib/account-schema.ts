import sql from "@/lib/db";

let ensured: Promise<void> | null = null;

/** Colunas opcionais de investment_accounts (TURBO e rentabilidade contratada). Roda uma vez por processo. */
export function ensureAccountColumns(): Promise<void> {
  ensured ??= (async () => {
    await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS is_turbo BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS cdi_percent NUMERIC(6,2)`;
    await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS max_rendimento NUMERIC(12,2)`;
    await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(12,2)`;
    await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS rate_index TEXT`;
    await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS rate_value NUMERIC(10,4)`;
    await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS maturity DATE`;
    await sql`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN`;
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}
