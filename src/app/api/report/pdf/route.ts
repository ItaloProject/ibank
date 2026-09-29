import { NextResponse } from "next/server";
import { requireBotUser } from "@/lib/server/bot-auth";
import { getCachedSnapshot } from "@/lib/server/portfolio-snapshot";
import { renderReportPdf, reportPdfFilename } from "@/lib/report/report-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  const s = await getCachedSnapshot(auth.userId);
  if (!s.plan) return NextResponse.json({ error: "Cadastre seus investimentos para gerar o relatório." }, { status: 404 });
  const pdf = await renderReportPdf(s);
  const disposition = new URL(request.url).searchParams.has("download") ? "attachment" : "inline";
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${reportPdfFilename(s)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
