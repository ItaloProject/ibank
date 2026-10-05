import sql from "@/lib/db";

let ensured = false;

/**
 * done_months: meses (yyyy-MM) em que o grupo foi marcado como feito; os grupos valem para todos os meses, a marcação não.
 * paid: item já pago; os itens já são de um mês só.
 */
export async function ensurePlanGroupSchema() {
  if (ensured) return;
  await sql`ALTER TABLE plan_groups ADD COLUMN IF NOT EXISTS done_months TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false`;
  ensured = true;
}
