import sql from "@/lib/db";

let ensured = false;

/** Adds the onboarding columns once per process. */
export async function ensureOnboardingColumns() {
  if (ensured) return;
  const existing = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'carteira_vista_profile'
  `;
  if (existing.length === 0) {
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS carteira_vista_profile VARCHAR(50) DEFAULT NULL`;
    // Quem já tinha perfil antes desta coluna existir já passou pela carteira sugerida
    await sql`
      UPDATE app_users SET carteira_vista_profile = investment_profile
      WHERE investment_profile IS NOT NULL
    `;
  }
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS risk_profile VARCHAR(20) DEFAULT NULL`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS risk_quiz_at TIMESTAMPTZ DEFAULT NULL`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS declared_spending NUMERIC(12,2) DEFAULT NULL`;
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
