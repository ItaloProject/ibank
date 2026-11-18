import sql from "@/lib/db";
import { ensurePlanGroupSchema } from "@/lib/plan-groups";

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
 * Itens novos entram pendentes (actual=0); só parcelas já pagas no contador
 * entram como pagas. Itens existentes não são recriados (ON CONFLICT).
 */
export async function syncInstallmentItems(userId: string, month: string) {
  await ensureInstallmentSchema();
  await ensurePlanGroupSchema();
  await sql`
    INSERT INTO plan_items (user_id, group_id, month, name, type, planned, actual, paid, installment_id)
    SELECT
      ${userId}, g.id, ${month},
      LEFT(ip.description, 180) || ' (' || (m.k + 1) || '/' || ip.installments || ')',
      'fixo',
      ROUND(ip.total_amount / ip.installments, 2),
      CASE WHEN m.k < ip.paid_installments THEN ROUND(ip.total_amount / ip.installments, 2) ELSE 0 END,
      (m.k < ip.paid_installments),
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
  await syncInstallmentPaidFlags(userId);
}

/**
 * Alinha paid/actual dos itens de parcela com paid_installments.
 * Parcelamentos é a fonte da verdade do contador de parcelas pagas.
 */
export async function syncInstallmentPaidFlags(userId: string, installmentId?: string) {
  await ensureInstallmentSchema();
  await ensurePlanGroupSchema();
  if (installmentId) {
    await sql`
      UPDATE plan_items pi
      SET
        paid = (m.k < ip.paid_installments),
        actual = CASE
          WHEN m.k < ip.paid_installments THEN ROUND(ip.total_amount / ip.installments, 2)
          ELSE 0
        END
      FROM installment_plans ip
      CROSS JOIN LATERAL (
        SELECT (split_part(pi.month, '-', 1)::int - EXTRACT(YEAR FROM ip.start_date)::int) * 12
             + (split_part(pi.month, '-', 2)::int - EXTRACT(MONTH FROM ip.start_date)::int) AS k
      ) m
      WHERE pi.installment_id = ip.id
        AND pi.user_id = ${userId}
        AND ip.user_id = ${userId}
        AND ip.id = ${installmentId}::uuid
        AND ip.start_date IS NOT NULL
        AND m.k >= 0 AND m.k < ip.installments
    `;
    return;
  }
  await sql`
    UPDATE plan_items pi
    SET
      paid = (m.k < ip.paid_installments),
      actual = CASE
        WHEN m.k < ip.paid_installments THEN ROUND(ip.total_amount / ip.installments, 2)
        ELSE 0
      END
    FROM installment_plans ip
    CROSS JOIN LATERAL (
      SELECT (split_part(pi.month, '-', 1)::int - EXTRACT(YEAR FROM ip.start_date)::int) * 12
           + (split_part(pi.month, '-', 2)::int - EXTRACT(MONTH FROM ip.start_date)::int) AS k
    ) m
    WHERE pi.installment_id = ip.id
      AND pi.user_id = ${userId}
      AND ip.user_id = ${userId}
      AND ip.start_date IS NOT NULL
      AND m.k >= 0 AND m.k < ip.installments
  `;
}

/** Mês civil atual em America/Sao_Paulo (YYYY-MM). */
export function mesAtualBrasil(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
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
