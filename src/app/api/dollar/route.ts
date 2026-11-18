import { NextResponse } from "next/server";

// Cotação do dólar (USD → BRL) em tempo real: valor atual e variação do dia em R$.
const URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";

export async function GET() {
  try {
    const res = await fetch(URL, { next: { revalidate: 300 } }); // cache de 5 min
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const bid = Number(data?.USDBRL?.bid);
    const change = Number(data?.USDBRL?.varBid);
    if (!Number.isFinite(bid) || bid <= 0) throw new Error("cotação inválida");
    return NextResponse.json({ bid, change: Number.isFinite(change) ? change : 0 });
  } catch {
    return NextResponse.json({ bid: null, change: 0 }, { status: 502 });
  }
}
