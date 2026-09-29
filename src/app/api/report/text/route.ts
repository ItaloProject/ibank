import { NextResponse } from "next/server";
import { requireBotUser } from "@/lib/server/bot-auth";
import { getCachedSnapshot } from "@/lib/server/portfolio-snapshot";
import { buildReportText } from "@/lib/report/report-text";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  const s = await getCachedSnapshot(auth.userId);
  if (!s.plan) return NextResponse.json({ error: "Cadastre seus investimentos para gerar o relatório." }, { status: 404 });
  return NextResponse.json({ text: buildReportText(s), filename: `relatorio-muvo-${s.geradoEm.slice(0, 10)}.png` });
}
