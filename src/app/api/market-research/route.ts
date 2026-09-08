import { NextResponse } from "next/server";
import { buildMarketResearch } from "@/lib/market-research";

export async function GET() {
  try {
    const data = await buildMarketResearch();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        rates: {
          selicAnual: 15.0,
          cdiAnual: 14.9,
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
