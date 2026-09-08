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

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { account_id, type, amount, description, date } = await request.json();
    const rows = await sql`
      INSERT INTO investments (account_id, type, amount, description, date, user_id)
      VALUES (${account_id}, ${type}, ${amount}, ${description ?? ""}, ${date}, ${userId})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/investments]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
