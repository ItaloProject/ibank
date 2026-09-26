import sql from "@/lib/db";
import { loadUserSnapshot } from "@/lib/server/portfolio-snapshot";
import { renderReportImage } from "@/lib/report/report-image";
import { buildReportText, firstName, reportDate } from "@/lib/report/report-text";
import { sendImage, sendTemplate, sendText, templateParam, uploadMedia, type WhatsappConfig } from "@/lib/whatsapp";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Envia imagem + texto dentro da janela de 24 horas. */
export async function sendFullReport(cfg: WhatsappConfig, userId: string, to: string) {
  const s = await loadUserSnapshot(userId);
  const text = buildReportText(s);
  if (s.plan) {
    const png = await renderReportImage(s);
    const mediaId = await uploadMedia(cfg, png, "image/png", `relatorio-muvo-${s.geradoEm.slice(0, 10)}.png`);
    await sendImage(cfg, to, mediaId, `Relatório MUVO · ${reportDate(s.geradoEm)}`);
  }
  await sendText(cfg, to, text);
  await sql`UPDATE app_users SET whatsapp_pending_report_at = NULL WHERE user_id = ${userId}`;
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
