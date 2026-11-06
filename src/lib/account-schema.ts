import sql from "@/lib/db";
import { missingColumns, runDdl } from "@/lib/schema-check";

const ACCOUNT_COLUMNS = [
  "is_turbo",
  "cdi_percent",
  "max_rendimento",
  "valor_liquido",
  "rate_index",
  "rate_value",
  "maturity",
  "tax_exempt",
] as const;

let ensured: Promise<void> | null = null;

/** Colunas opcionais de investment_accounts. Só faz ALTER se algo faltar — evita fila de locks no cold start. */
export function ensureAccountColumns(): Promise<void> {
  ensured ??= (async () => {
    const missing = await missingColumns("investment_accounts", [...ACCOUNT_COLUMNS]);
    if (missing.length === 0) return;
    await runDdl(async (tx) => {
      if (missing.includes("is_turbo")) await tx`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS is_turbo BOOLEAN DEFAULT FALSE`;
      if (missing.includes("cdi_percent")) await tx`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS cdi_percent NUMERIC(6,2)`;
      if (missing.includes("max_rendimento")) await tx`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS max_rendimento NUMERIC(12,2)`;
      if (missing.includes("valor_liquido")) await tx`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(12,2)`;
      if (missing.includes("rate_index")) await tx`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS rate_index TEXT`;
      if (missing.includes("rate_value")) await tx`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS rate_value NUMERIC(10,4)`;
      if (missing.includes("maturity")) await tx`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS maturity DATE`;
      if (missing.includes("tax_exempt")) await tx`ALTER TABLE investment_accounts ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN`;
    });
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}
