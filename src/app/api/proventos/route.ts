import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import sql from "@/lib/db";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("ibank_session")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.userId ?? null;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
