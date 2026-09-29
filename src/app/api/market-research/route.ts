import { NextResponse } from "next/server";
import { buildMarketResearch } from "@/lib/market-research";
import { FALLBACK_CDI, FALLBACK_SELIC } from "@/lib/investment-rates";

export async function GET() {
  try {
    const data = await buildMarketResearch();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        rates: {
          selicAnual: FALLBACK_SELIC,
          cdiAnual: FALLBACK_CDI,
          updatedAt: new Date().toLocaleDateString("pt-BR"),
          source: "fallback",
        },
        fiis: [],
        fetchedAt: new Date().toISOString(),
        error: String(err),
      },
      { status: 200 },
    );
  }
}
