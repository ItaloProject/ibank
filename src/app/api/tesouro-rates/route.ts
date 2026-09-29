import { NextResponse } from "next/server";
import { getTesouroLive } from "@/lib/server/tesouro-live";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Taxas de compra do Tesouro Direto do último dia publicado, por id do catálogo. */
export async function GET() {
  const live = await getTesouroLive();
  return NextResponse.json(live ?? { date: null, rates: {} }, {
    headers: { "Cache-Control": live ? "public, max-age=1800, s-maxage=3600" : "no-store" },
  });
}
