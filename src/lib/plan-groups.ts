import sql from "@/lib/db";

let ensured = false;

/** Meses (yyyy-MM) em que o usuário marcou o grupo como feito: os grupos valem para todos os meses, a marcação não. */
export async function ensurePlanGroupSchema() {
  if (ensured) return;
  await sql`ALTER TABLE plan_groups ADD COLUMN IF NOT EXISTS done_months TEXT[] NOT NULL DEFAULT '{}'`;
  ensured = true;
}
