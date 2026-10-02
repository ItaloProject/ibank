"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Copy, Download, ImageIcon, Loader2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { groupWhatsAppText, slug, type PlanReportGroup } from "@/lib/report/plan-share";

/** Mostra *negrito* e _itálico_ como o WhatsApp vai exibir. */
function WhatsAppPreview({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li) => {
        const parts: ReactNode[] = [];
        const re = /\*([^*\n]+)\*|_([^_\n]+)_/g;
        let last = 0;
        for (let m = re.exec(line); m; m = re.exec(line)) {
          if (m.index > last) parts.push(line.slice(last, m.index));
          parts.push(m[1] != null ? <strong key={m.index}>{m[1]}</strong> : <em key={m.index} className="text-muted-foreground">{m[2]}</em>);
          last = m.index + m[0].length;
        }
        parts.push(line.slice(last));
        return (
          <Fragment key={li}>
            {li > 0 && <br />}
            {parts}
          </Fragment>
        );
      })}
    </>
  );
}

export function GroupShareDialog({
  group,
  monthLabel,
  onOpenChange,
}: {
  group: PlanReportGroup | null;
  monthLabel: string;
  onOpenChange: (open: boolean) => void;
}) {
  const text = useMemo(() => (group ? groupWhatsAppText(group, monthLabel) : ""), [group, monthLabel]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // A imagem é gerada ao abrir: no celular, o compartilhamento precisa acontecer logo após o toque.
  useEffect(() => {
    if (!group) return;
    let alive = true;
    let url: string | null = null;
    setFile(null);
    setPreview(null);
    setError(null);
    setCopied(false);
    (async () => {
      try {
        const res = await fetch("/api/plan-report/group-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group, monthLabel }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não foi possível gerar a imagem.");
        const blob = await res.blob();
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setFile(new File([blob], `muvo-${slug(group.name) || "grupo"}-${slug(monthLabel)}.png`, { type: "image/png" }));
        setPreview(url);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Não foi possível gerar a imagem.");
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [group, monthLabel]);

  function download() {
    if (!file || !preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = file.name;
    a.click();
  }

  function openWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function share() {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    download();
    openWhatsApp();
    toast.success("Imagem baixada. Anexe no WhatsApp junto com o texto.");
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Texto copiado. É só colar no WhatsApp.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o texto.");
    }
  }

  const canCopyImage = typeof window !== "undefined" && "ClipboardItem" in window;
  async function copyImage() {
    if (!file) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
      toast.success("Imagem copiada. Cole na conversa do WhatsApp.");
    } catch {
      toast.error("Seu navegador não deixou copiar a imagem. Use Baixar imagem.");
    }
  }

  return (
    <Dialog open={group != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compartilhar {group?.name}</DialogTitle>
          <DialogDescription>Imagem com a marca Muvo e o resumo em texto, prontos para o WhatsApp.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[15rem]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border bg-[#0A0A0A]">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={`Resumo do grupo ${group?.name ?? ""}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-white/60">
                  {error ? (
                    <span>{error}</span>
                  ) : (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      Gerando imagem…
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Button variant="outline" size="sm" className="min-h-10 text-xs" onClick={download} disabled={!file}>
                <Download className="h-3.5 w-3.5" />
                Baixar
              </Button>
              {canCopyImage && (
                <Button variant="outline" size="sm" className="min-h-10 text-xs" onClick={copyImage} disabled={!file}>
                  <ImageIcon className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Mensagem</p>
            <div className="max-h-72 overflow-y-auto rounded-xl rounded-tl-sm border bg-muted/40 px-3.5 py-3 text-[13px] leading-relaxed [overflow-wrap:anywhere]">
              <WhatsAppPreview text={text} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="outline" size="sm" className="min-h-10 text-xs" onClick={copyText}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar texto"}
              </Button>
              <Button variant="outline" size="sm" className="min-h-10 text-xs" onClick={openWhatsApp}>
                <MessageCircle className="h-3.5 w-3.5" />
                Só o texto
              </Button>
            </div>
          </div>
        </div>

        <Button className="min-h-11 w-full" onClick={share} disabled={!file}>
          {file ? <Share2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
          Compartilhar imagem e texto
        </Button>
      </DialogContent>
    </Dialog>
  );
}
