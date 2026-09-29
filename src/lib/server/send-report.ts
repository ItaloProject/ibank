import sql from "@/lib/db";
import { evoSendDocument, evoSendText, type EvolutionConfig } from "@/lib/evolution";
import { loadUserSnapshot, type UserSnapshot } from "@/lib/server/portfolio-snapshot";
import { renderReportImage } from "@/lib/report/report-image";
import { renderReportPdf, reportPdfFilename } from "@/lib/report/report-pdf";
import { buildReportText, firstName, reportDate } from "@/lib/report/report-text";
import { sendDocument, sendTemplate, sendText, templateParam, uploadMedia, type WhatsappConfig } from "@/lib/whatsapp";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function pdfCaption(s: UserSnapshot): string {
  const nome = firstName(s.nome);
  return `Relatório MUVO${nome ? ` de ${nome}` : ""} · ${reportDate(s.geradoEm)}\nPatrimônio: ${brl(s.plan!.total)} · Rende ${pct(s.plan!.retorno12m)} ao ano esperado, sem Imposto de Renda.`;
}

/** Dentro da janela de 24 horas: PDF do relatório (ou o texto, se ainda não há carteira). */
export async function sendFullReport(cfg: WhatsappConfig, userId: string, to: string) {
  const s = await loadUserSnapshot(userId);
  if (s.plan) {
    const filename = reportPdfFilename(s);
    const mediaId = await uploadMedia(cfg, await renderReportPdf(s), "application/pdf", filename);
    await sendDocument(cfg, to, mediaId, filename, pdfCaption(s));
  } else {
    await sendText(cfg, to, buildReportText(s));
  }
  await sql`UPDATE app_users SET whatsapp_pending_report_at = NULL WHERE user_id = ${userId}`;
}

/** PDF do relatório pela Evolution API (sem janela nem modelo). */
export async function sendReportViaEvolution(cfg: EvolutionConfig, userId: string, to: string) {
  const s = await loadUserSnapshot(userId);
  if (s.plan) await evoSendDocument(cfg, to, await renderReportPdf(s), pdfCaption(s), reportPdfFilename(s));
  else await evoSendText(cfg, to, buildReportText(s));
}

/**
 * Fora da janela: modelo aprovado com a imagem no cabeçalho. O texto completo fica
 * pendente e sai quando o usuário responder (ver webhook).
 */
export async function sendTemplateReport(cfg: WhatsappConfig, userId: string, to: string) {
  const s = await loadUserSnapshot(userId);
  if (!s.plan || !cfg.reportTemplate) throw new Error("Relatório indisponível");
  const png = await renderReportImage(s);
  const mediaId = await uploadMedia(cfg, png, "image/png", `relatorio-muvo-${s.geradoEm.slice(0, 10)}.png`);
  const principal = s.plan.sugestoes[0]?.titulo ?? "carteira alinhada ao seu perfil";
  await sendTemplate(cfg, to, cfg.reportTemplate, [
    { type: "header", parameters: [{ type: "image", image: { id: mediaId } }] },
    {
      type: "body",
      parameters: [
        templateParam(firstName(s.nome) || "investidor"),
        templateParam(brl(s.plan.total)),
        templateParam(pct(s.plan.retorno12m)),
        templateParam(principal),
      ],
    },
  ]);
  await sql`UPDATE app_users SET whatsapp_pending_report_at = NOW() WHERE user_id = ${userId}`;
}
