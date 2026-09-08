import { NextResponse } from "next/server";

// Série 12 do SGS/Bacen = taxa CDI diária (% ao dia).
// Permite acumular o CDI exato de um período em vez de estimar pela taxa anual.
const SGS_12 = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados";

/** "2025-03-01" -> "01/03/2025" (formato aceito pelo SGS) */
function toBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "01/03/2025" -> "2025-03-01" */
function toIso(br: string): string {
  const [d, m, y] = br.split("/");
  return `${y}-${m}-${d}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end") ?? new Date().toISOString().slice(0, 10);

  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return NextResponse.json({ error: "Parâmetro 'start' inválido (use YYYY-MM-DD)" }, { status: 400 });
  }

  const url = `${SGS_12}?formato=json&dataInicial=${toBr(start)}&dataFinal=${toBr(end)}`;

  try {
    const res = await fetch(url, { next: { revalidate: 21600 } }); // 6h
    if (!res.ok) throw new Error(`SGS respondeu ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("Formato inesperado");

    const series = rows
      .map((r: { data: string; valor: string }) => ({
        date: toIso(String(r.data)),
        rate: Number(String(r.valor).replace(",", ".")),
      }))
      .filter((r) => Number.isFinite(r.rate));

    return NextResponse.json({ series, source: "bcb" });
  } catch {
    // Sem a série diária o cliente cai no fallback pela taxa anual.
    return NextResponse.json({ series: [], source: "unavailable" });
  }
}
