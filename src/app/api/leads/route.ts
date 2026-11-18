import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { limitar } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // Lead público: evita spam encher a tabela.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const limite = await limitar({ chave: `leads:${ip}`, max: 8, janelaSeg: 3600 });
    if (!limite.ok) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente de novo mais tarde." },
        { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
      );
    }

    const body = await request.json();
    const { nome, whatsapp, objetivo, aporte } = body ?? {};

    if (!nome || !whatsapp) {
      return NextResponse.json({ error: "nome e whatsapp são obrigatórios" }, { status: 400 });
    }

    const nomeLimpo = String(nome).trim().slice(0, 100);
    const zapLimpo = String(whatsapp).replace(/\D/g, "").slice(0, 20);
    if (nomeLimpo.length < 2 || zapLimpo.length < 10) {
      return NextResponse.json({ error: "nome ou whatsapp inválido" }, { status: 400 });
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
      VALUES (
        ${nomeLimpo},
        ${zapLimpo},
        ${String(objetivo ?? "").slice(0, 50)},
        ${String(aporte ?? "").slice(0, 30)}
      )
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("leads POST:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
