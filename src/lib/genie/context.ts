import { NUMBER_RE, normalize, parseNumber } from "./calc";

/** O que o Gênio lembra da conversa para entender "nele", "também" e "na verdade é 110". */
export type GenieMemory = {
  /** Último item mexido. */
  item: string | null;
  /** Último grupo usado. */
  group: string | null;
  /** Tipo do último pedido feito. */
  last: "addItems" | "spend" | "setPlanned" | "addIncome" | null;
};

export type FollowUp =
  | { kind: "correct"; value: number }
  | { kind: "more"; value: number }
  | { kind: "text"; text: string };

const N = NUMBER_RE;

/** Reescreve pedidos que dependem do que veio antes; null se a frase se sustenta sozinha. */
export function followUp(raw: string, mem: GenieMemory): FollowUp | null {
  const r = raw.trim().replace(/[?!.]+$/, "").trim();
  const t = normalize(r);

  if (mem.last) {
    const fix = t.match(new RegExp(String.raw`^(?:(?:na verdade|alias|opa|ops|errei|corrigindo|corrige|corrija|nao)\b[,\s]*)+(?:(?:o valor|valor|e|era|foi|sao|eram|fica|ficou|para|pra|de)\s+)*(${N})(?:\s+reais)?$`))
      ?? t.match(new RegExp(String.raw`^(?:era|foi|eram|foram)\s+(${N})(?:\s+reais)?$`));
    const value = fix ? parseNumber(fix[1]) : null;
    if (value !== null) return { kind: "correct", value };
  }

  if (mem.item) {
    const more = t.match(new RegExp(String.raw`^(?:(?:coloca|adiciona|bota|soma|poe|lanca|acrescenta|mais)\s+)?mais\s+(${N})(?:\s+(?:nele|nela|nisso|no item|nesse item|neste item))?$`))
      ?? t.match(new RegExp(String.raw`^(?:soma|acrescenta|adiciona|coloca|bota)\s+(${N})\s+(?:nele|nela|nisso|nesse item|neste item)$`));
    const value = more ? parseNumber(more[1]) : null;
    if (value !== null) return { kind: "more", value };
  }

  let text = r;
  if (mem.item) text = text.replace(/\b(?:nele|nela|nesse item|neste item|no mesmo item)\b/gi, `em ${mem.item}`);
  if (mem.group) text = text.replace(/\b(?:no mesmo grupo|na mesma categoria|nesse grupo|neste grupo|no grupo dele|nessa categoria)\b/gi, `em ${mem.group}`);

  if ((mem.last === "addItems" || mem.last === "spend") && (/^e\s/i.test(text) || /\btamb[eé]m\b/i.test(text))) {
    const rest = text
      .replace(/^e\s+/i, "")
      .replace(/\btamb[eé]m\b/gi, " ")
      .replace(/^\s*(?:o|a|os|as)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (rest) {
      const inGroup = mem.group && !/\b(?:em|no|na|grupo)\s/i.test(rest) ? ` em ${mem.group}` : "";
      return { kind: "text", text: mem.last === "addItems" ? `adicionar ${rest}${inGroup}` : `gastei ${rest}${inGroup}` };
    }
  }

  return text !== r ? { kind: "text", text } : null;
}
