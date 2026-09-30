import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { syncInstallmentItems } from "@/lib/installments";
import { getMonthIncomes } from "@/lib/plan-income";
import { computeLeftover, leftoverMonths } from "@/lib/plan-leftover";

export const dynamic = "force-dynamic";

/** Sobra do Planejamento no mês anterior e no atual (só meses com renda informada). */
export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  try {
    const months = leftoverMonths();
    const result = [];
    for (const month of months) {
      await syncInstallmentItems(userId, month);
      const [incomes, items] = await Promise.all([
        getMonthIncomes(userId, month),
        sql`SELECT actual FROM plan_items WHERE user_id = ${userId} AND month = ${month} AND type IN ('fixo', 'variavel')`,
      ]);
      const l = computeLeftover(month, incomes.map((r) => r.amount), items.map((r) => Number(r.actual)));
      if (l.renda > 0) result.push(l);
    }
    return NextResponse.json({ months: result });
  } catch (err) {
    console.error("[GET /api/plan-leftover]", err);
    return NextResponse.json({ error: "Não foi possível ler o Planejamento." }, { status: 500 });
  }
}
