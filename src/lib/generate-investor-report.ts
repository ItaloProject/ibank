import { formatCurrency } from "@/lib/utils";

export type InvestorReportInsight = {
  level: "critical" | "warning" | "ok" | "suggestion";
  title: string;
  detail: string;
  action?: string;
};

export type InvestorReportSource = {
  nome: string;
  tipo: string;
  capital: number;
  rendaMensal: number;
};

export type InvestorReportRecommendation = {
  label: string;
  atual: number;
  ideal: number;
  cor: string;
  desc: string;
};

export type InvestorReportNextMove = {
  prioridade: number;
  label: string;
  valor: string;
  razao: string;
};

export type PrintInvestorReportArgs = {
  portfolioAnalysis: {
    insights: InvestorReportInsight[];
    nextMoves: InvestorReportNextMove[];
    score: number;
    emerTotal: number;
    fiiPctVariavel: number;
  };
  investorData: {
    allSources: InvestorReportSource[];
    totalRendaMensal: number;
    recommendations: InvestorReportRecommendation[];
  };
  grandTotal: number;
};

export function printInvestorReport(args: PrintInvestorReportArgs) {
  const { insights, nextMoves, score, emerTotal, fiiPctVariavel } = args.portfolioAnalysis;
  const { allSources, totalRendaMensal, recommendations } = args.investorData;
  const grandTotal = args.grandTotal;
    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const levelColors: Record<string, string> = { critical: "#ef4444", warning: "#f59e0b", ok: "#10b981", suggestion: "#6366f1" };
    const levelLabels: Record<string, string> = { critical: "CRÍTICO", warning: "ATENÇÃO", ok: "OK", suggestion: "SUGESTÃO" };

    const insightsHtml = insights.map((ins) => `
      <div style="border-left:4px solid ${levelColors[ins.level]};padding:10px 14px;margin-bottom:10px;background:${ins.level === "critical" ? "#fef2f2" : ins.level === "warning" ? "#fffbeb" : ins.level === "ok" ? "#f0fdf4" : "#eef2ff"};border-radius:4px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="background:${levelColors[ins.level]};color:white;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:3px;">${levelLabels[ins.level]}</span>
          <strong style="font-size:13px;">${ins.title}</strong>
        </div>
        <p style="margin:0;color:#555;font-size:12px;">${ins.detail}</p>
        ${ins.action ? `<p style="margin:4px 0 0;color:${levelColors[ins.level]};font-size:12px;font-weight:600;">→ ${ins.action}</p>` : ""}
      </div>`).join("");

    const allocationHtml = recommendations.map((r) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 12px;font-weight:600;">${r.label}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:bold;">${r.atual.toFixed(1)}%</td>
        <td style="padding:8px 12px;text-align:right;color:#888;">${r.ideal}%</td>
        <td style="padding:8px 12px;text-align:right;color:${r.atual >= r.ideal ? "#10b981" : "#f59e0b"};font-weight:bold;">${r.atual >= r.ideal ? "✓ OK" : `+${(r.ideal - r.atual).toFixed(0)}%`}</td>
      </tr>`).join("");

    const sourcesHtml = allSources.map((s) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 12px;font-weight:600;">${s.nome}</td>
        <td style="padding:8px 12px;color:#888;">${s.tipo}</td>
        <td style="padding:8px 12px;text-align:right;">${formatCurrency(s.capital)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:bold;color:#10b981;">+${formatCurrency(s.rendaMensal)}/mês</td>
      </tr>`).join("");

    const nextMovesHtml = nextMoves.map((m) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 12px;text-align:center;font-weight:bold;color:#6366f1;">${m.prioridade}</td>
        <td style="padding:8px 12px;font-weight:600;">${m.label}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:bold;color:#10b981;">${m.valor}</td>
        <td style="padding:8px 12px;font-size:12px;color:#666;">${m.razao}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>MUVO — Análise de Carteira</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:white;color:#111;padding:32px;max-width:900px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6366f1;padding-bottom:20px;margin-bottom:28px}
  .header h1{font-size:28px;font-weight:900;color:#6366f1}.header p{color:#888;font-size:13px;margin-top:4px}
  .score{background:#6366f1;color:white;border-radius:50%;width:72px;height:72px;display:flex;align-items:center;justify-content:center;flex-direction:column;font-weight:900;font-size:22px}
  .score small{font-size:9px;font-weight:600;opacity:.8}section{margin-bottom:28px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:12px;font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:#f8f9fb;border-radius:8px;padding:14px 16px}
  .card .lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
  .card .val{font-size:20px;font-weight:900}.card .sub{font-size:11px;color:#888;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:8px 12px;background:#f3f4f6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa}
  @media print{body{padding:16px}}</style></head><body>
  <div class="header"><div><h1>MUVO</h1><p>Relatório de Análise de Carteira</p><p style="margin-top:4px;">${dateStr}</p></div>
  <div class="score">${score}<small>SCORE</small></div></div>
  <section><h2>Resumo do Patrimônio</h2>
  <div class="grid">
  <div class="card"><div class="lbl">Patrimônio Total</div><div class="val">${formatCurrency(grandTotal)}</div><div class="sub">renda fixa + ações</div></div>
  <div class="card"><div class="lbl">Renda Passiva Est.</div><div class="val" style="color:#6366f1;">${formatCurrency(totalRendaMensal)}</div><div class="sub">por mês</div></div>
  <div class="card"><div class="lbl">Reserva Emergência</div><div class="val" style="color:${emerTotal >= 3000 ? "#10b981" : "#ef4444"};">${formatCurrency(emerTotal)}</div><div class="sub">${emerTotal >= 3000 ? "adequada" : "insuficiente"}</div></div>
  <div class="card"><div class="lbl">FIIs na Variável</div><div class="val" style="color:${fiiPctVariavel >= 50 ? "#10b981" : "#f59e0b"};">${fiiPctVariavel.toFixed(0)}%</div><div class="sub">ideal 50–60%</div></div>
  </div></section>
  <section><h2>Diagnóstico da Carteira</h2>${insightsHtml}</section>
  <section><h2>Fontes de Renda Mensal</h2><table><thead><tr><th>Fonte</th><th>Tipo</th><th style="text-align:right;">Capital</th><th style="text-align:right;">Renda/mês</th></tr></thead><tbody>${sourcesHtml || "<tr><td colspan='4' style='padding:12px;color:#888;text-align:center;'>Nenhuma fonte identificada ainda</td></tr>"}</tbody></table></section>
  <section><h2>Alocação Atual vs. Ideal</h2><table><thead><tr><th>Categoria</th><th style="text-align:right;">Atual</th><th style="text-align:right;">Ideal</th><th style="text-align:right;">Status</th></tr></thead><tbody>${allocationHtml}</tbody></table></section>
  <section><h2>Próximos Aportes Recomendados</h2><table><thead><tr><th style="text-align:center;">#</th><th>Destino</th><th style="text-align:right;">Valor</th><th>Motivo</th></tr></thead><tbody>${nextMovesHtml}</tbody></table></section>
  <div class="footer">Gerado pelo MUVO em ${dateStr} · Estimativas baseadas em taxas de mercado · Não constitui assessoria regulada pela CVM/ANCORD</div>
  </body></html>`;

    // Usa um iframe oculto em vez de window.open: bloqueadores de pop-up não afetam iframes,
    // então o PDF sempre gera mesmo com pop-ups bloqueados no navegador.
    let iframe = document.getElementById("ibank-report-frame") as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "ibank-report-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe!.contentWindow?.focus();
      iframe!.contentWindow?.print();
    }, 300);
}
