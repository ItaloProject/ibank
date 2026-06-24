import { NextResponse } from "next/server";

// Busca taxas oficiais em tempo real na API do Banco Central (SGS).
// 432  = Meta Selic definida pelo Copom (% a.a.)
// 4389 = Taxa CDI anualizada base 252 (% a.a.)
const SELIC_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json";
const CDI_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json";

async function fetchSerie(url: string): Promise<{ data: string; valor: number } | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache de 1h
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const last = rows[rows.length - 1];
    return { data: String(last.data), valor: Number(String(last.valor).replace(",", ".")) };
  } catch {
    return null;
  }
}

export async function GET() {
  const [selic, cdi] = await Promise.all([fetchSerie(SELIC_URL), fetchSerie(CDI_URL)]);

  if (selic) {
    return NextResponse.json({
      selicAnual: selic.valor,
      // CDI costuma ficar ~0,10 p.p. abaixo da Selic; usa fallback se a série falhar.
      cdiAnual: cdi?.valor ?? Math.max(selic.valor - 0.1, 0),
      updatedAt: selic.data,
      source: "bcb",
    });
  }

  // Fallback caso a API do BC esteja indisponível.
  return NextResponse.json({
    selicAnual: 15.0,
    cdiAnual: 14.9,
    updatedAt: new Date().toLocaleDateString("pt-BR"),
    source: "fallback",
  });
}
