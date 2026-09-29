"use client";

import { Fragment, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useUser } from "@/context/user-context";
import { readBotPageContext } from "@/lib/bot-page-context";
import { FOCUS } from "@/components/investimentos/live-ui";

function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
          : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

/**
 * Pergunta pronta ao assistente dentro de janelas modais (que cobrem o botão do bot),
 * com a tela atual como contexto. A resposta some quando `resetKey` muda.
 */
export function AskMuvoInline({ question, label, resetKey }: { question: string; label: string; resetKey: string }) {
  const { botEnabled } = useUser();
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAnswer(null);
    setError(null);
  }, [resetKey]);

  if (!botEnabled) return null;

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: question }], page: readBotPageContext() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(res.status === 503 ? "O assistente não está disponível agora." : data?.error ?? "Não consegui responder agora.");
      setAnswer(String(data?.reply ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui responder agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" aria-live="polite">
      {!answer && (
        <button
          type="button"
          onClick={ask}
          disabled={busy}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60 ${FOCUS}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          {busy ? "Muvo está analisando…" : label}
        </button>
      )}
      {error && <p className="text-xs text-muted-foreground">{error}</p>}
      {answer && (
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">Muvo</p>
          {answer.split(/\n+/).filter(Boolean).map((line, i) => (
            <p key={i}><Bold text={line.replace(/^[-•]\s+/, "• ")} /></p>
          ))}
        </div>
      )}
    </div>
  );
}
