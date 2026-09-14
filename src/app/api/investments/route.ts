import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    let rows;
    if (accountId && start && end) {
      rows = await sql`
        SELECT * FROM investments
        WHERE user_id = ${userId} AND account_id = ${accountId} AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC
      `;
    } else if (accountId) {
      rows = await sql`
        SELECT * FROM investments WHERE user_id = ${userId} AND account_id = ${accountId} ORDER BY date DESC
      `;
    } else if (start && end) {
      rows = await sql`
        SELECT * FROM investments WHERE user_id = ${userId} AND date >= ${start} AND date <= ${end} ORDER BY date DESC
      `;
    } else {
      rows = await sql`SELECT * FROM investments WHERE user_id = ${userId} ORDER BY date DESC`;
    }

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/investments]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

const VALID_TYPES = new Set(["deposito", "retirada", "rendimento"]);

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { account_id, type, amount, description, date } = await request.json();

    if (typeof account_id !== "string" || !account_id) {
      return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
    }
    if (typeof type !== "string" || !VALID_TYPES.has(type)) {
      return NextResponse.json({ error: "type inválido" }, { status: 400 });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "amount deve ser um número positivo" }, { status: 400 });
    }
    if (typeof date !== "string" || !date) {
      return NextResponse.json({ error: "date é obrigatório" }, { status: 400 });
    }

    // Confirma que a conta existe e pertence ao usuário autenticado (evita IDOR).
    const accountRows = await sql`
      SELECT id, is_turbo, current_balance FROM investment_accounts
      WHERE id = ${account_id} AND user_id = ${userId}
    `;
    const account = accountRows[0];
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    // Retirada não pode exceder o saldo real da conta (bloqueia saldo negativo via API direta).
    if (type === "retirada") {
      let balance: number;
      if (account.is_turbo) {
        balance = Number(account.current_balance) || 0;
      } else {
        const balRows = await sql`
          SELECT COALESCE(SUM(CASE WHEN type = 'retirada' THEN -amount ELSE amount END), 0) AS balance
          FROM investments WHERE account_id = ${account_id} AND user_id = ${userId}
        `;
        balance = Number(balRows[0]?.balance) || 0;
      }
      if (amountNum > balance + 0.01) {
        return NextResponse.json({ error: "Saldo insuficiente para essa retirada" }, { status: 400 });
      }
    }

    const rows = await sql`
      INSERT INTO investments (account_id, type, amount, description, date, user_id)
      VALUES (${account_id}, ${type}, ${amountNum}, ${description ?? ""}, ${date}, ${userId})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/investments]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
