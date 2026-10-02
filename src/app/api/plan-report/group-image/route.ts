import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { renderPlanGroupImage } from "@/lib/report/plan-image";
import { slug, type PlanReportGroup, type PlanReportItem } from "@/lib/report/plan-share";

export const dynamic = "force-dynamic";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? n : 0;
};

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const g = body?.group;
  if (!g || typeof g.name !== "string" || !Array.isArray(g.items) || typeof body.monthLabel !== "string") {
    return NextResponse.json({ error: "Dados do grupo inválidos." }, { status: 400 });
  }
  const group: PlanReportGroup = {
    name: g.name.slice(0, 60),
    color: typeof g.color === "string" ? g.color : "#FAFAFA",
    items: (g.items as Record<string, unknown>[]).slice(0, 200).map(
      (i): PlanReportItem => ({
        name: String(i.name ?? "").slice(0, 80),
        type: i.type === "fixo" ? "fixo" : "variavel",
        planned: money(i.planned),
        actual: money(i.actual),
      }),
    ),
  };
  const monthLabel = body.monthLabel.slice(0, 40);

  const png = await renderPlanGroupImage(group, monthLabel);
  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="muvo-${slug(group.name) || "grupo"}-${slug(monthLabel)}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
