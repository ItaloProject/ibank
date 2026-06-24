import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    let rows;
    if (accountId && start && end) {
      rows = await sql`
        SELECT * FROM investments
        WHERE account_id = ${accountId} AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC
      `;
    } else if (accountId) {
      rows = await sql`
        SELECT * FROM investments WHERE account_id = ${accountId} ORDER BY date DESC
      `;
    } else if (start && end) {
      rows = await sql`
        SELECT * FROM investments WHERE date >= ${start} AND date <= ${end} ORDER BY date DESC
      `;
    } else {
      rows = await sql`SELECT * FROM investments ORDER BY date DESC`;
    }

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/investments]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { account_id, type, amount, description, date } = await request.json();
    const rows = await sql`
      INSERT INTO investments (account_id, type, amount, description, date)
      VALUES (${account_id}, ${type}, ${amount}, ${description ?? ""}, ${date})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/investments]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
