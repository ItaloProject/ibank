"use client";

import { useCallback, useEffect, useState } from "react";

export type WhatsappStatus = {
  configured: boolean;
  connected: boolean;
  phone: string | null;
  windowOpen: boolean;
  templateReady: boolean;
  /** Envio automático possível para qualquer número (exige modelo aprovado). */
  autoAvailable: boolean;
};

export type SendResult =
  | { ok: true; mode: "full" | "template"; phone?: string }
  | { ok: false; error: string; code?: string };

export function useWhatsapp() {
  const [status, setStatus] = useState<WhatsappStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as WhatsappStatus;
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unlink = useCallback(async () => {
    await fetch("/api/whatsapp/link", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  /** Sem argumentos usa o número salvo; com `phone` salva o número (com consentimento) e envia. */
  const sendReport = useCallback(async (input?: { phone: string; consent: boolean }): Promise<SendResult> => {
    try {
      const res = await fetch("/api/whatsapp/report", {
        method: "POST",
        headers: input ? { "Content-Type": "application/json" } : undefined,
        body: input ? JSON.stringify(input) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (input || data?.code === "not_connected") void refresh();
      if (res.ok) return { ok: true, mode: data?.mode === "template" ? "template" : "full", phone: data?.phone };
      return { ok: false, error: data?.error ?? "Não foi possível enviar.", code: data?.code };
    } catch {
      return { ok: false, error: "Sem conexão. Tente de novo." };
    }
  }, [refresh]);

  return { status, refresh, unlink, sendReport };
}
