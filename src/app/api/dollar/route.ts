import { NextResponse } from "next/server";

// Cotação do dólar (USD → BRL): valor atual e variação do dia em R$.
// Fonte principal: AwesomeAPI (tempo real). Reserva: Frankfurter (BCE, fechamento diário),
// usada quando a principal limita ou falha (ex.: 429 nos servidores compartilhados).
const AWESOME_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const HEADERS = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; MUVO)" };

type Quote = { bid: number; change: number };

async function fromAwesome(): Promise<Quote> {
  const res = await fetch(AWESOME_URL, { headers: HEADERS, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`awesomeapi ${res.status}`);
  const data = await res.json();
  const bid = Number(data?.USDBRL?.bid);
  const change = Number(data?.USDBRL?.varBid);
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("awesomeapi: cotação inválida");
  return { bid, change: Number.isFinite(change) ? change : 0 };
}

async function fromFrankfurter(): Promise<Quote> {
  const start = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10);
  const res = await fetch(`https://api.frankfurter.dev/v1/${start}..?base=USD&symbols=BRL`, {
    headers: HEADERS,
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`frankfurter ${res.status}`);
  const data = await res.json();
  const days = Object.keys(data?.rates ?? {}).sort();
  const last = Number(data?.rates?.[days[days.length - 1]]?.BRL);
  const prev = Number(data?.rates?.[days[days.length - 2]]?.BRL);
  if (!Number.isFinite(last) || last <= 0) throw new Error("frankfurter: cotação inválida");
  return { bid: last, change: Number.isFinite(prev) ? last - prev : 0 };
}

export async function GET() {
  const errors: string[] = [];
  for (const source of [fromAwesome, fromFrankfurter]) {
    try {
      return NextResponse.json(await source());
    } catch (e) {
      errors.push(String(e));
    }
  }
  return NextResponse.json({ bid: null, change: 0, error: errors.join("; ") }, { status: 502 });
}
