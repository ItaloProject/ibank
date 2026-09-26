"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Image as ImageIcon, Loader2, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsapp, type SendResult } from "./use-whatsapp";

type Variant = "bot" | "app";

const STYLES: Record<Variant, { text: string; muted: string; primary: string; secondary: string; box: string; link: string; ring: string }> = {
  bot: {
    text: "text-white",
    muted: "text-white/50",
    primary: "bg-white text-[#0D0D0D] hover:bg-white/90",
    secondary: "border border-white/15 text-white/80 hover:bg-white/[0.08] hover:text-white",
    box: "rounded-xl border border-white/[0.08] bg-white/[0.03]",
    link: "text-white/60 hover:text-white",
    ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05050A]",
  },
  app: {
    text: "text-foreground",
    muted: "text-muted-foreground",
    primary: "bg-foreground text-background hover:bg-foreground/90",
    secondary: "border border-border text-foreground hover:bg-muted",
    box: "rounded-xl border bg-card",
    link: "text-muted-foreground hover:text-foreground",
    ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  },
};

export function WhatsappPanel({ variant = "bot", autoSend = false }: { variant?: Variant; autoSend?: boolean }) {
  const st = STYLES[variant];
  const { status, error, pending, link, unlink, sendReport, cancelLink } = useWhatsapp();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const btn = cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-50", st.ring);

  async function connect() {
    setLinkError(null);
    setBusy(true);
    try {
      const { url } = await link();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Não foi possível gerar o código.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setResult(null);
    setResult(await sendReport());
    setBusy(false);
  }

  if (!status) {
    return (
      <div className={cn("flex items-center gap-2 p-3 text-xs", st.box, st.muted)}>
        {error ?? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Verificando seu WhatsApp…</>}
      </div>
    );
  }

  if (!status.configured) {
    return (
      <p className={cn("p-3 text-xs leading-relaxed", st.box, st.muted)}>
        O envio pelo WhatsApp ainda não foi ativado neste ambiente. Enquanto isso, você pode baixar a imagem do relatório.{" "}
        <a href="/api/report/image" target="_blank" rel="noopener" className={cn("font-semibold underline underline-offset-2", st.link)}>Ver relatório</a>
      </p>
    );
  }

  if (!status.connected) {
    return (
      <div className={cn("space-y-3 p-3", st.box)}>
        <div className="flex items-start gap-2.5">
          <MessageCircle className={cn("mt-0.5 h-4 w-4 shrink-0", st.muted)} aria-hidden="true" />
          <p className={cn("text-xs leading-relaxed", st.muted)}>
            Conecte seu WhatsApp para receber o relatório com a imagem da carteira e as sugestões de rebalanceamento.
            Você envia um código para o MUVO, e isso confirma que o número é seu.
          </p>
        </div>
        {pending ? (
          <div className="space-y-2" aria-live="polite">
            <p className={cn("text-xs", st.text)}>
              Envie a mensagem com o código <strong className="font-mono tracking-wider">MUVO-{pending.code}</strong> no WhatsApp. Aguardando…
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={pending.url} target="_blank" rel="noopener noreferrer" className={cn(btn, st.primary)}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir WhatsApp
              </a>
              <button type="button" onClick={cancelLink} className={cn(btn, st.secondary)}>Cancelar</button>
            </div>
            <p className={cn("flex items-center gap-1.5 text-[11px]", st.muted)}>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> O código vale por 15 minutos.
            </p>
          </div>
        ) : (
          <button type="button" onClick={connect} disabled={busy} className={cn(btn, st.primary, "w-full")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MessageCircle className="h-4 w-4" aria-hidden="true" />}
            Conectar WhatsApp
          </button>
        )}
        {linkError && <p role="alert" className="text-xs text-red-500">{linkError}</p>}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 p-3", st.box)}>
      <p className={cn("flex items-center gap-2 text-xs", st.muted)}>
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
        Conectado a <span className={cn("font-semibold tabular-nums", st.text)}>{status.phone}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={send} disabled={busy} className={cn(btn, st.primary, "flex-1")} autoFocus={autoSend}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Enviando…" : "Enviar para meu WhatsApp"}
        </button>
        <a href="/api/report/image" target="_blank" rel="noopener" className={cn(btn, st.secondary)}>
          <ImageIcon className="h-4 w-4" aria-hidden="true" /> Prévia
        </a>
      </div>
      {result && (
        <div aria-live="polite" className="text-xs leading-relaxed">
          {result.ok ? (
            <p className="text-emerald-500">
              {result.mode === "full"
                ? "Enviado! Confira seu WhatsApp: a imagem e o texto com as sugestões já estão lá."
                : "Enviamos a imagem com o resumo. Responda a mensagem no WhatsApp para receber o texto completo."}
            </p>
          ) : (
            <div className="space-y-2">
              <p role="alert" className={result.code === "window_closed" ? st.text : "text-red-500"}>{result.error}</p>
              {result.url && (
                <a href={result.url} target="_blank" rel="noopener noreferrer" className={cn(btn, st.secondary)}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" /> Mandar “oi” no WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={() => void unlink()} className={cn("text-[11px] underline underline-offset-2", st.link, st.ring)}>
        Desconectar este número
      </button>
    </div>
  );
}
