import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import {
  MONTH_RE,
  ensurePlanIncomeTable,
  getMonthIncomes,
  parseIncomeInput,
  syncMonthTotal,
} from "@/lib/plan-income";

export async function GET(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const month = new URL(request.url).searchParams.get("month") ?? "";
    if (!MONTH_RE.test(month)) return NextResponse.json({ error: "Mês inválido" }, { status: 400 });

    const incomes = await getMonthIncomes(userId, month);
    return NextResponse.json({ incomes });
  } catch (err) {
    console.error("[GET /api/plan-income]", err);
    return NextResponse.json({ error: "Erro ao carregar receitas" }, { status: 500 });
  }
}

/** Cria uma receita ({ month, description, amount }) ou copia as de outro mês ({ month, copyFrom }). */
export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const body = await request.json();
    const month = typeof body?.month === "string" ? body.month : "";
    if (!MONTH_RE.test(month)) return NextResponse.json({ error: "Mês inválido" }, { status: 400 });

    await ensurePlanIncomeTable();

    if (typeof body.copyFrom === "string") {
      if (!MONTH_RE.test(body.copyFrom)) return NextResponse.json({ error: "Mês de origem inválido" }, { status: 400 });
      const source = await getMonthIncomes(userId, body.copyFrom);
      if (source.length === 0) {
        return NextResponse.json({ error: "O mês anterior não tem receitas." }, { status: 404 });
      }
      for (const inc of source) {
        await sql`
          INSERT INTO plan_income (user_id, month, description, amount)
          VALUES (${userId}, ${month}, ${inc.description}, ${inc.amount})
        `;
      }
      const incomes = await syncMonthTotal(userId, month);
      return NextResponse.json({ incomes, copied: source.length });
    }

    const parsed = parseIncomeInput(body);
    if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

    // Garante que a renda antiga do mês vire receita antes de somar a nova.
    await getMonthIncomes(userId, month);
    await sql`
      INSERT INTO plan_income (user_id, month, description, amount)
      VALUES (${userId}, ${month}, ${parsed.description}, ${parsed.amount})
    `;
    const incomes = await syncMonthTotal(userId, month);
    return NextResponse.json({ incomes }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/plan-income]", err);
    return NextResponse.json({ error: "Erro ao salvar receita" }, { status: 500 });
  }
}
