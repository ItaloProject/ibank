"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WhatsappStatus = {
  configured: boolean;
  connected: boolean;
  phone: string | null;
  windowOpen: boolean;
  templateReady: boolean;
};

export type SendResult =
  | { ok: true; mode: "full" | "template" }
  | { ok: false; error: string; url?: string; code?: string };

const POLL_MS = 4000;
const LINK_TTL_MS = 15 * 60 * 1000;

export function useWhatsapp() {
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ code: string; url: string; at: number } | null>(null);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível verificar o WhatsApp.");
        return null;
      }
      setError(null);
      setStatus(data as WhatsappStatus);
      return data as WhatsappStatus;
    } catch {
      setError("Sem conexão. Tente de novo.");
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pending) return;
    timer.current = window.setInterval(async () => {
      if (Date.now() - pending.at > LINK_TTL_MS) {
        setPending(null);
        return;
      }
      const s = await refresh();
      if (s?.connected) setPending(null);
    }, POLL_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [pending, refresh]);

  const link = useCallback(async () => {
    const res = await fetch("/api/whatsapp/link", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Não foi possível gerar o código.");
    setPending({ code: data.code, url: data.url, at: Date.now() });
    return data as { code: string; url: string };
  }, []);

  const unlink = useCallback(async () => {
    await fetch("/api/whatsapp/link", { method: "DELETE" });
    setPending(null);
    await refresh();
  }, [refresh]);

  const sendReport = useCallback(async (): Promise<SendResult> => {
    try {
      const res = await fetch("/api/whatsapp/report", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok) return { ok: true, mode: data?.mode === "template" ? "template" : "full" };
      if (data?.code === "not_connected") void refresh();
      return { ok: false, error: data?.error ?? "Não foi possível enviar.", url: data?.url, code: data?.code };
    } catch {
      return { ok: false, error: "Sem conexão. Tente de novo." };
    }
  }, [refresh]);

  return { status, error, pending, refresh, link, unlink, sendReport, cancelLink: () => setPending(null) };
}
