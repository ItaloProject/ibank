import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, whatsapp, objetivo, aporte } = body ?? {};

    if (!nome || !whatsapp) {
      return NextResponse.json({ error: "nome e whatsapp são obrigatórios" }, { status: 400 });
    }

    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        whatsapp VARCHAR(20) NOT NULL,
        objetivo VARCHAR(50),
        aporte VARCHAR(30),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO leads (nome, whatsapp, objetivo, aporte)
      VALUES (${String(nome)}, ${String(whatsapp)}, ${String(objetivo ?? "")}, ${String(aporte ?? "")})
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("leads POST:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
