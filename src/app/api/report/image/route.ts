import { NextResponse } from "next/server";
import { requireBotUser } from "@/lib/server/bot-auth";
import { loadUserSnapshot } from "@/lib/server/portfolio-snapshot";
import { renderReportImage } from "@/lib/report/report-image";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  const s = await loadUserSnapshot(auth.userId);
  if (!s.plan) return NextResponse.json({ error: "Cadastre seus investimentos para gerar o relatório." }, { status: 404 });
  const png = await renderReportImage(s);
  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="relatorio-muvo-${s.geradoEm.slice(0, 10)}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
