/**
 * Cliente da WhatsApp Cloud API (Meta).
 *
 * Mensagens livres (texto, imagem) só podem ser enviadas até 24 horas depois da
 * última mensagem do usuário. Fora dessa janela, só modelos (templates) aprovados.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type WhatsappConfig = {
  token: string;
  phoneNumberId: string;
  /** Número do WhatsApp do MUVO, só dígitos com DDI (para links wa.me). */
  businessNumber: string;
  verifyToken: string;
  appSecret: string | null;
  apiVersion: string;
  reportTemplate: string | null;
  templateLang: string;
};

export function whatsappConfig(): WhatsappConfig | null {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const businessNumber = process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "");
  if (!token || !phoneNumberId || !businessNumber) return null;
  return {
    token,
    phoneNumberId,
    businessNumber,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET?.trim() || null,
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || "v23.0",
    reportTemplate: process.env.WHATSAPP_REPORT_TEMPLATE?.trim() || null,
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "pt_BR",
  };
}

export class WhatsappError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
  }
}

export const SESSION_WINDOW_MS = 24 * 3600 * 1000;

export function isWindowOpen(lastInbound: string | Date | null | undefined, now = Date.now()): boolean {
  if (!lastInbound) return false;
  const t = new Date(lastInbound).getTime();
  return Number.isFinite(t) && now - t < SESSION_WINDOW_MS - 5 * 60 * 1000;
}

export function waLink(businessNumber: string, text: string): string {
  return `https://wa.me/${businessNumber}?text=${encodeURIComponent(text)}`;
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 8) return d;
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) •••••-${d.slice(-4)}`;
}

/** Valida o cabeçalho X-Hub-Signature-256 enviado pela Meta. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const received = Buffer.from(header.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function graph<T>(cfg: WhatsappConfig, path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new WhatsappError(err?.error_user_msg || err?.message || `WhatsApp respondeu ${res.status}`, err?.code);
  }
  return data as T;
}

async function sendMessage(cfg: WhatsappConfig, to: string, payload: Record<string, unknown>): Promise<string> {
  const data = await graph<{ messages?: { id: string }[] }>(cfg, `${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
  });
  return data.messages?.[0]?.id ?? "";
}

export function sendText(cfg: WhatsappConfig, to: string, body: string) {
  return sendMessage(cfg, to, { type: "text", text: { body: body.slice(0, 4096), preview_url: false } });
}

export async function uploadMedia(cfg: WhatsappConfig, data: ArrayBuffer, mime: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([data], { type: mime }), filename);
  const res = await graph<{ id: string }>(cfg, `${cfg.phoneNumberId}/media`, { method: "POST", body: form });
  return res.id;
}

export function sendImage(cfg: WhatsappConfig, to: string, mediaId: string, caption?: string) {
  return sendMessage(cfg, to, { type: "image", image: { id: mediaId, ...(caption ? { caption: caption.slice(0, 1024) } : {}) } });
}

/** Parâmetros de modelo não aceitam quebras de linha, tabs nem mais de 4 espaços seguidos. */
export function templateParam(text: string): { type: "text"; text: string } {
  return { type: "text", text: text.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").slice(0, 1024) };
}

export function sendTemplate(cfg: WhatsappConfig, to: string, name: string, components: Record<string, unknown>[]) {
  return sendMessage(cfg, to, { type: "template", template: { name, language: { code: cfg.templateLang }, components } });
}
