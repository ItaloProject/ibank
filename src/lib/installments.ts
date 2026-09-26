import sql from "@/lib/db";

let ensured = false;

/** Tabela de parcelamentos e vínculo das parcelas com o planejamento. */
export async function ensureInstallmentSchema() {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS installment_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL DEFAULT 'italo',
      description TEXT NOT NULL,
      total_amount NUMERIC(12,2) NOT NULL,
      installments INTEGER NOT NULL,
      paid_installments INTEGER NOT NULL DEFAULT 0,
      start_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE installment_plans ADD COLUMN IF NOT EXISTS plan_group_id UUID`;
  await sql`ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS installment_id UUID`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS plan_items_installment_month_idx
    ON plan_items (installment_id, month) WHERE installment_id IS NOT NULL
  `;
  ensured = true;
}

/**
 * Garante no mês o item de cada parcela vinculada a um grupo.
 * Itens já existentes não são tocados, então o valor real editado no planejamento é preservado.
 */
export async function syncInstallmentItems(userId: string, month: string) {
  await ensureInstallmentSchema();
  await sql`
    INSERT INTO plan_items (user_id, group_id, month, name, type, planned, actual, installment_id)
    SELECT
      ${userId}, g.id, ${month},
      LEFT(ip.description, 180) || ' (' || (m.k + 1) || '/' || ip.installments || ')',
      'fixo',
      ROUND(ip.total_amount / ip.installments, 2),
      ROUND(ip.total_amount / ip.installments, 2),
      ip.id
    FROM installment_plans ip
    JOIN plan_groups g ON g.id = ip.plan_group_id AND g.user_id = ip.user_id
    CROSS JOIN LATERAL (
      SELECT (split_part(${month}, '-', 1)::int - EXTRACT(YEAR FROM ip.start_date)::int) * 12
           + (split_part(${month}, '-', 2)::int - EXTRACT(MONTH FROM ip.start_date)::int) AS k
    ) m
    WHERE ip.user_id = ${userId}
      AND ip.start_date IS NOT NULL
      AND m.k >= 0 AND m.k < ip.installments
      AND NOT (
        ip.paid_installments >= ip.installments
        AND ${month} > to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')
      )
    ON CONFLICT (installment_id, month) WHERE installment_id IS NOT NULL DO NOTHING
  `;
}

/** Remove as parcelas do mês atual em diante; o histórico dos meses passados fica. */
export async function clearUpcomingInstallmentItems(userId: string, installmentId: string) {
  await ensureInstallmentSchema();
  await sql`
    DELETE FROM plan_items
    WHERE user_id = ${userId}
      AND installment_id = ${installmentId}
      AND month >= to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')
  `;
}
