"use client";

import { useCallback, useEffect, useState } from "react";

export type ShareOutcome =
  | { ok: true; how: "shared" | "copied" | "downloaded" }
  | { ok: false; error: string };

type Loaded = { file: File; text: string };

/** Legendas do WhatsApp aceitam ~1000 caracteres; o texto completo fica para "Copiar texto". */
export function shortReportText(text: string, max = 900): string {
  if (text.length <= max) return text;
  const out: string[] = [];
  let size = 0;
  for (const line of text.split("\n")) {
    if (size + line.length + 1 > max) break;
    out.push(line);
    size += line.length + 1;
  }
  return `${out.join("\n").trimEnd()}\n\n…análise completa no app MUVO.`;
}

/**
 * Carrega imagem e texto do relatório assim que o painel aparece: no celular, o
 * compartilhamento precisa acontecer logo após o toque, sem esperar a rede.
 */
export function useReportShare() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [img, txt] = await Promise.all([fetch("/api/report/image"), fetch("/api/report/text")]);
        const info = await txt.json().catch(() => null);
        if (!img.ok || !txt.ok) throw new Error(info?.error ?? "Não foi possível gerar o relatório.");
        const blob = await img.blob();
        if (alive) setData({ file: new File([blob], info.filename, { type: "image/png" }), text: String(info.text) });
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Não foi possível gerar o relatório.");
      }
    })();
    return () => { alive = false; };
  }, []);

  const share = useCallback(async (): Promise<ShareOutcome> => {
    if (!data) return { ok: false, error: error ?? "O relatório ainda está sendo gerado." };
    const caption = shortReportText(data.text);

    if (navigator.canShare?.({ files: [data.file] })) {
      try {
        await navigator.share({ files: [data.file], text: caption });
        return { ok: true, how: "shared" };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return { ok: false, error: "" };
      }
    }

    let how: "copied" | "downloaded" = "downloaded";
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": data.file })]);
      how = "copied";
    } catch {
      const url = URL.createObjectURL(data.file);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank", "noopener,noreferrer");
    return { ok: true, how };
  }, [data, error]);

  const copyText = useCallback(async () => {
    if (!data) return false;
    try {
      await navigator.clipboard.writeText(data.text);
      return true;
    } catch {
      return false;
    }
  }, [data]);

  return { ready: data != null, error, share, copyText };
}
