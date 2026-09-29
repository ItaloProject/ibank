"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Copy, FileText, Loader2, Send, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsapp, type SendResult } from "./use-whatsapp";
import { useReportShare, type ShareOutcome } from "./use-report-share";

type Variant = "bot" | "app";

const STYLES: Record<Variant, { text: string; muted: string; primary: string; secondary: string; box: string; link: string; ring: string; input: string; divider: string }> = {
  bot: {
    text: "text-white",
    muted: "text-white/50",
    primary: "bg-white text-[#0D0D0D] hover:bg-white/90",
    secondary: "border border-white/15 text-white/80 hover:bg-white/[0.08] hover:text-white",
    box: "rounded-xl border border-white/[0.08] bg-white/[0.03]",
    link: "text-white/60 hover:text-white",
    ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05050A]",
    input: "border border-white/15 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-white/40",
    divider: "border-white/[0.08]",
  },
  app: {
    text: "text-foreground",
    muted: "text-muted-foreground",
    primary: "bg-foreground text-background hover:bg-foreground/90",
    secondary: "border border-border text-foreground hover:bg-muted",
    box: "rounded-xl border bg-card",
    link: "text-muted-foreground hover:text-foreground",
    ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    input: "border border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-foreground/40",
    divider: "border-border",
  },
};

const SHARE_MSG: Record<"shared" | "downloaded", string> = {
  shared: "Pronto! Escolha a conversa no WhatsApp e envie.",
  downloaded: "PDF baixado. Na conversa do WhatsApp que abriu, anexe o arquivo (clipe › Documento) e envie.",
};

/** Máscara (11) 98765-4321 enquanto digita; números com + ficam livres. */
function maskPhoneInput(raw: string): string {
  if (raw.trim().startsWith("+")) return raw.replace(/[^\d+\s()-]/g, "").slice(0, 20);
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function WhatsappPanel({ variant = "bot" }: { variant?: Variant }) {
  const st = STYLES[variant];
  const { status, unlink, sendReport } = useWhatsapp();
  const report = useReportShare();
  const [shareResult, setShareResult] = useState<ShareOutcome | null>(null);
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const btn = cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-50", st.ring);

  async function share() {
    setShareResult(await report.share());
  }

  async function copy() {
    setCopied(await report.copyText());
    setTimeout(() => setCopied(false), 2500);
  }

  async function sendTo(e?: FormEvent) {
    e?.preventDefault();
    setSending(true);
    setSendResult(null);
    const res = await sendReport(showForm ? { phone, consent } : undefined);
    setSendResult(res);
    if (res.ok) setEditing(false);
    setSending(false);
  }

  const showForm = editing || !status?.connected;

  return (
    <div className={cn("space-y-3 p-3", st.box)}>
      <p className={cn("text-xs leading-relaxed", st.muted)}>
        Gera um PDF com seu nome, suas posições, a reserva, a alocação e as sugestões de rebalanceamento, pronto para enviar no WhatsApp.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void share()} disabled={!report.ready} className={cn(btn, st.primary, "flex-1")}>
          {report.ready ? <Share2 className="h-4 w-4" aria-hidden="true" /> : <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {report.ready ? "Compartilhar no WhatsApp" : "Gerando relatório…"}
        </button>
        <a href="/api/report/pdf" target="_blank" rel="noopener" className={cn(btn, st.secondary)}>
          <FileText className="h-4 w-4" aria-hidden="true" /> Ver PDF
        </a>
      </div>

      {report.error && <p role="alert" className="text-xs text-red-500">{report.error}</p>}
      {shareResult && (shareResult.ok || shareResult.error) && (
        <div aria-live="polite" className="space-y-2">
          <p className={cn("text-xs leading-relaxed", shareResult.ok ? "text-emerald-500" : "text-red-500")}>
            {shareResult.ok ? SHARE_MSG[shareResult.how] : shareResult.error}
          </p>
          {shareResult.ok && (
            <button type="button" onClick={() => void copy()} className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold underline underline-offset-2", st.link, st.ring)}>
              <Copy className="h-3 w-3" aria-hidden="true" />
              {copied ? "Texto copiado!" : "Copiar texto completo com todas as sugestões"}
            </button>
          )}
        </div>
      )}

      {status?.autoAvailable && (
        <div className={cn("space-y-2.5 border-t pt-3", st.divider)}>
          <p className={cn("text-xs font-semibold", st.text)}>Ou receba direto no seu WhatsApp</p>

          {showForm ? (
            <form onSubmit={sendTo} className="space-y-2.5">
              <div className="flex gap-2">
                <label htmlFor={`wa-phone-${variant}`} className="sr-only">Seu número de WhatsApp</label>
                <input
                  id={`wa-phone-${variant}`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(11) 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                  className={cn("min-h-10 min-w-0 flex-1 rounded-md px-3 text-sm tabular-nums outline-none transition-colors", st.input, st.ring)}
                />
                <button type="submit" disabled={sending || phone.replace(/\D/g, "").length < 10 || !consent} className={cn(btn, st.primary)}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  Enviar
                </button>
              </div>
              <label className={cn("flex cursor-pointer items-start gap-2 text-[11px] leading-snug", st.muted)}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-current" />
                Este número é meu e autorizo o MUVO a me enviar relatórios pelo WhatsApp.
              </label>
              {editing && (
                <button type="button" onClick={() => setEditing(false)} className={cn("text-[11px] underline underline-offset-2", st.link, st.ring)}>
                  Cancelar
                </button>
              )}
            </form>
          ) : (
            <div className="space-y-2">
              <button type="button" onClick={() => void sendTo()} disabled={sending} className={cn(btn, st.secondary, "w-full")}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                {sending ? "Enviando…" : <>Enviar para <span className="tabular-nums">{status.phone}</span></>}
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setEditing(true); setSendResult(null); }} className={cn("text-[11px] underline underline-offset-2", st.link, st.ring)}>
                  Trocar número
                </button>
                <button type="button" onClick={() => { setSendResult(null); void unlink(); }} className={cn("text-[11px] underline underline-offset-2", st.link, st.ring)}>
                  Remover número
                </button>
              </div>
            </div>
          )}

          {sendResult && (
            <p aria-live="polite" role={sendResult.ok ? undefined : "alert"} className={cn("text-xs leading-relaxed", sendResult.ok ? "text-emerald-500" : "text-red-500")}>
              {sendResult.ok ? (
                <span className="inline-flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {sendResult.mode === "full"
                    ? "Enviado! O PDF do relatório já está no seu WhatsApp."
                    : "Enviado! Responda a mensagem no WhatsApp para receber o PDF completo."}
                </span>
              ) : sendResult.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
