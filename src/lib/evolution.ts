/**
 * Envio pelo WhatsApp via Evolution API (instância própria conectada por QR code).
 * Não usa a API oficial da Meta: não há modelo nem janela de 24 horas.
 */
import { WhatsappError } from "@/lib/whatsapp";

export type EvolutionConfig = {
  url: string;
  apiKey: string;
  instance: string;
};

export function evolutionConfig(): EvolutionConfig | null {
  const url = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_INSTANCE?.trim();
  if (!url || !apiKey || !instance) return null;
  return { url, apiKey, instance };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errorMessage(data: any, status: number): string {
  const msg = data?.response?.message;
  if (Array.isArray(msg)) {
    if (msg.some((m) => m && typeof m === "object" && m.exists === false)) return "Este número não tem WhatsApp";
    const first = msg.find((m) => typeof m === "string");
    if (first) return first;
  }
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  return `Evolution API respondeu ${status}`;
}

async function post(cfg: EvolutionConfig, path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${cfg.url}/message/${path}/${encodeURIComponent(cfg.instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new WhatsappError(errorMessage(data, res.status), res.status);
  }
}

export function evoSendText(cfg: EvolutionConfig, number: string, text: string) {
  return post(cfg, "sendText", { number, text });
}

export function evoSendImage(cfg: EvolutionConfig, number: string, png: ArrayBuffer, caption: string, fileName: string) {
  return post(cfg, "sendMedia", {
    number,
    mediatype: "image",
    mimetype: "image/png",
    media: Buffer.from(png).toString("base64"),
    caption,
    fileName,
  });
}
