import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    await sql`
      CREATE TABLE IF NOT EXISTS proventos (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        ticker VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_day INT NOT NULL,
        type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    const rows = await sql`
      SELECT * FROM proventos
      WHERE user_id = ${userId}
      ORDER BY payment_day ASC
    `;

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/proventos]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { ticker, amount, payment_day, type } = await request.json();

    if (!ticker || amount == null || !payment_day || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const day = Number(payment_day);
    if (day < 1 || day > 31) {
      return NextResponse.json({ error: "payment_day must be between 1 and 31" }, { status: 400 });
    }

    await sql`
      CREATE TABLE IF NOT EXISTS proventos (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        ticker VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_day INT NOT NULL,
        type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    const rows = await sql`
      INSERT INTO proventos (user_id, ticker, amount, payment_day, type)
      VALUES (${userId}, ${String(ticker).toUpperCase()}, ${Number(amount)}, ${day}, ${type})
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/proventos]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
