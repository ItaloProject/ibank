import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { missingTables, runDdl } from "@/lib/schema-check";

let ensured: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  ensured ??= (async () => {
    if ((await missingTables(["stock_quotes"])).length === 0) return;
    await runDdl(async (tx) => {
      await tx`
        CREATE TABLE IF NOT EXISTS stock_quotes (
          user_id      TEXT NOT NULL,
          ticker       TEXT NOT NULL,
          current_price NUMERIC(12,4) NOT NULL,
          updated_at   TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (user_id, ticker)
        )
      `;
    });
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensureTable();
    const rows = await sql`SELECT * FROM stock_quotes WHERE user_id = ${userId}`;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: "Erro interno. Tente novamente em instantes." }, { status: 500 });
  }
}

type QuoteIn = { ticker: string; current_price: number };

function parseQuotes(body: unknown): QuoteIn[] {
  if (!body || typeof body !== "object") return [];
  const o = body as { ticker?: unknown; current_price?: unknown; quotes?: unknown };
  if (Array.isArray(o.quotes)) {
    return o.quotes
      .filter((q): q is QuoteIn => !!q && typeof q === "object" && typeof (q as QuoteIn).ticker === "string" && Number.isFinite(Number((q as QuoteIn).current_price)))
      .map((q) => ({ ticker: String(q.ticker).toUpperCase(), current_price: Number(q.current_price) }))
      .slice(0, 80);
  }
  if (typeof o.ticker === "string" && Number.isFinite(Number(o.current_price))) {
    return [{ ticker: o.ticker.toUpperCase(), current_price: Number(o.current_price) }];
  }
  return [];
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensureTable();
    const quotes = parseQuotes(await request.json());
    if (quotes.length === 0) {
      return NextResponse.json({ error: "Informe ticker e preço." }, { status: 400 });
    }

    // Um upsert por vez na mesma request — evita N round-trips HTTP do cliente.
    const rows = [];
    for (const q of quotes) {
      const [row] = await sql`
        INSERT INTO stock_quotes (user_id, ticker, current_price, updated_at)
        VALUES (${userId}, ${q.ticker}, ${q.current_price}, NOW())
        ON CONFLICT (user_id, ticker)
        DO UPDATE SET current_price = ${q.current_price}, updated_at = NOW()
        RETURNING *
      `;
      if (row) rows.push(row);
    }

    // Compat: um único ticker continua devolvendo o objeto; lote devolve array.
    return NextResponse.json(quotes.length === 1 ? rows[0] : rows);
  } catch (err) {
    return NextResponse.json({ error: "Erro interno. Tente novamente em instantes." }, { status: 500 });
  }
}
