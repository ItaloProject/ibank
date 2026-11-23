import type { Block, Msg } from "@/lib/bot-replies";

/** Números e textos da resposta em markdown simples, para o app (sem botões, cards ou gráficos). */
function blockToMarkdown(b: Block): string | null {
  switch (b.kind) {
    case "heading":
      return `**${b.text}**`;
    case "text":
    case "md":
      return b.text;
    case "stats":
      return b.items
        .map((i) => `- ${i.label}: **${i.value}**${i.hint ? ` (${i.hint})` : ""}`)
        .join("\n");
    case "bars":
      return [`**${b.title}**`, ...b.items.map((i) => `- ${i.label}: ${Math.round(i.atual)}% → ${Math.round(i.ideal)}%`)].join("\n");
    case "list": {
      const linhas = b.items.map((i, idx) => {
        const prefixo = b.ordered ? `${idx + 1}. ` : "- ";
        const extras = [i.meta, i.value].filter(Boolean).join(" — ");
        const linha = `${prefixo}**${i.title}**${extras ? ` · ${extras}` : ""}`;
        return i.detail ? `${linha}\n  ${i.detail}` : linha;
      });
      return [b.title ? `**${b.title}**` : null, ...linhas].filter(Boolean).join("\n");
    }
    case "alert":
      return `${b.tone === "pos" ? "✅" : "⚠️"} ${b.text}`;
    default:
      // Botões, cards de WhatsApp/PDF e escolha de perfil são só da tela do site.
      return null;
  }
}

/** Texto da resposta do assistente (o mesmo conteúdo das respostas do site). */
export function msgToMarkdown(m: Msg): string {
  if (m.role !== "bot") return "";
  return m.blocks
    .map(blockToMarkdown)
    .filter((t): t is string => !!t)
    .join("\n\n");
}
