import sql from "@/lib/db";

export type PlanIncome = {
  id: string;
  description: string;
  amount: number;
};

export const MONTH_RE = /^\d{4}-\d{2}$/;
export const MAX_DESCRIPTION = 80;

let ensured = false;

/** Cria a tabela de receitas detalhadas uma vez por processo. */
export async function ensurePlanIncomeTable() {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS plan_income (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(20) NOT NULL,
      month VARCHAR(7) NOT NULL,
      description VARCHAR(80) NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS plan_income_user_month_idx ON plan_income (user_id, month)`;
  ensured = true;
}

function toIncome(row: Record<string, unknown>): PlanIncome {
  return { id: String(row.id), description: String(row.description), amount: Number(row.amount) };
}

async function listIncomes(userId: string, month: string): Promise<PlanIncome[]> {
  const rows = await sql`
    SELECT id, description, amount FROM plan_income
    WHERE user_id = ${userId} AND month = ${month}
    ORDER BY created_at, id
  `;
  return rows.map(toIncome);
}

/**
 * Lista as receitas do mês. Meses que só têm a renda antiga (valor único em plan_salary)
 * viram uma receita "Salário" com o mesmo valor, para o detalhamento começar completo.
 */
export async function getMonthIncomes(userId: string, month: string): Promise<PlanIncome[]> {
  await ensurePlanIncomeTable();
  const incomes = await listIncomes(userId, month);
  if (incomes.length > 0) return incomes;

  const legacy = await sql`
    SELECT salary FROM plan_salary WHERE user_id = ${userId} AND month = ${month}
  `;
  const legacySalary = legacy[0] ? Number(legacy[0].salary) : 0;
  if (legacySalary <= 0) return [];

  await sql`
    INSERT INTO plan_income (user_id, month, description, amount)
    SELECT ${userId}, ${month}, 'Salário', ${legacySalary}
    WHERE NOT EXISTS (SELECT 1 FROM plan_income WHERE user_id = ${userId} AND month = ${month})
  `;
  return listIncomes(userId, month);
}

/** Mantém plan_salary igual à soma das receitas: Dashboard, painéis e relatório leem esse total. */
export async function syncMonthTotal(userId: string, month: string): Promise<PlanIncome[]> {
  const incomes = await listIncomes(userId, month);
  const total = incomes.reduce((s, i) => s + i.amount, 0);
  await sql`
    INSERT INTO plan_salary (user_id, month, salary)
    VALUES (${userId}, ${month}, ${total})
    ON CONFLICT (user_id, month) DO UPDATE SET salary = ${total}
  `;
  return incomes;
}

export function parseIncomeInput(body: unknown): { description: string; amount: number } | string {
  const { description, amount } = (body ?? {}) as { description?: unknown; amount?: unknown };
  const desc = typeof description === "string" ? description.trim() : "";
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!desc) return "Informe a referência da receita.";
  if (desc.length > MAX_DESCRIPTION) return `A referência pode ter até ${MAX_DESCRIPTION} caracteres.`;
  if (!Number.isFinite(value) || value <= 0) return "Informe um valor maior que zero.";
  if (value >= 1e10) return "Valor muito alto.";
  return { description: desc, amount: Math.round(value * 100) / 100 };
}
