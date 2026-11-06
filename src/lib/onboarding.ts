import sql from "@/lib/db";
import { missingColumns, runDdl } from "@/lib/schema-check";

let ensured = false;

const ONBOARDING_COLUMNS = [
  "carteira_vista_profile",
  "risk_profile",
  "risk_quiz_at",
  "declared_spending",
] as const;

/** Colunas de onboarding. Só altera o que falta — login não fica preso em ALTER. */
export async function ensureOnboardingColumns() {
  if (ensured) return;
  const missing = await missingColumns("app_users", [...ONBOARDING_COLUMNS]);
  if (missing.length > 0) {
    await runDdl(async (tx) => {
      if (missing.includes("carteira_vista_profile")) {
        await tx`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS carteira_vista_profile VARCHAR(50) DEFAULT NULL`;
      }
      if (missing.includes("risk_profile")) {
        await tx`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS risk_profile VARCHAR(20) DEFAULT NULL`;
      }
      if (missing.includes("risk_quiz_at")) {
        await tx`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS risk_quiz_at TIMESTAMPTZ DEFAULT NULL`;
      }
      if (missing.includes("declared_spending")) {
        await tx`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS declared_spending NUMERIC(12,2) DEFAULT NULL`;
      }
    });
    if (missing.includes("carteira_vista_profile")) {
      // Quem já tinha perfil antes desta coluna existir já passou pela carteira sugerida
      await sql`
        UPDATE app_users SET carteira_vista_profile = investment_profile
        WHERE investment_profile IS NOT NULL AND carteira_vista_profile IS NULL
      `;
    }
  }
  ensured = true;
}

export function hasSeenCarteira(row: {
  investment_profile?: string | null;
  carteira_vista_profile?: string | null;
}): boolean {
  return !!row.investment_profile && row.carteira_vista_profile === row.investment_profile;
}

/** Sem perfil de risco e sem ter respondido ou pulado o questionário: mostra o passo a passo. */
export function needsRiskQuiz(row: { risk_profile?: string | null; risk_quiz_at?: unknown }): boolean {
  return !row.risk_profile && !row.risk_quiz_at;
}
