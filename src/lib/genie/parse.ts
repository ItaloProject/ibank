import { NUMBER_RE, evaluate, foldMath, looksLikeMath, mathBody, normalize, parseNumber } from "./calc";
import { fixTypos, similar } from "./fuzzy";
import { INTENT_VERBS, canonicalize, extractSlots, guessIntent, type Intent } from "./translate";

export type ItemType = "fixo" | "variavel";
/** `calc`: a conta que o pedido trazia, como "1,19 + 34,01", para o Gênio mostrar de onde veio o valor. */
export type NewItem = { name: string; value: number; type: ItemType | null; calc?: string };

export type GenieCommand =
  | { kind: "calc"; expr: string; value: number }
  /** `paid`: "como gasto real" no pedido; o valor vai para o planejado e para o real. */
  | { kind: "addItems"; items: NewItem[]; group: string | null; paid?: boolean }
  | { kind: "spend"; name: string; value: number | null; group: string | null; calc?: string }
  | { kind: "createGroups"; names: string[] }
  | { kind: "addIncome"; description: string; value: number }
  | { kind: "query"; topic: "sobra" | "dia" | "gasto" | "renda" | "fixos" | "maiores" | "estourados" | "resumo"; target: string | null }
  | { kind: "cut"; pct: number | null; value: number | null; target: string }
  | { kind: "save"; total: number; months: number | null; monthly: number | null }
  | { kind: "compound"; monthly: number; initial: number; rateMonth: number; months: number; rateLabel: string }
  | { kind: "installment"; principal: number; parcelas: number; rateMonth: number }
  | { kind: "remove"; target: string; what: "item" | "group" | null }
  | { kind: "setPlanned"; name: string; value: number; calc?: string }
  /** Pedido de item sem valor (ou sem nome): o Gênio pergunta o que falta. */
  | { kind: "draftItem"; name: string | null; group: string | null }
  | { kind: "draftIncome"; description: string | null }
  | { kind: "draftSpend"; name: string; group: string | null }
  | { kind: "help" }
  | { kind: "unknown" };

const N = NUMBER_RE;
const num = (s: string | undefined) => (s ? parseNumber(s) : null);

const ADD_VERB = String.raw`(?:adiciona(?:r)?|adicione|add|coloca(?:r)?|coloque|inclui(?:r)?|inclua|lanca(?:r)?|lance|bota(?:r)?|bote|poe|planeja(?:r)?|planeje|cria(?:r)?\s+(?:o\s+)?item|novo\s+item)`;
const GROUP_PREP = /\s+(?:no grupo|na categoria|no grupo de|em|no|na|nos|nas|pro|pra|para o|para a|para)\s+(?:grupo\s+)?/g;

function cleanName(s: string): string {
  return s.replace(/^(o|a|os|as|um|uma|de|do|da|item)\s+/, "").replace(/\s+(de|do|da|por|no valor de|valor)$/, "").replace(/[.,;:!?]+$/, "").trim();
}

function typeOf(s: string): { type: ItemType | null; rest: string } {
  if (/\b(fixo|fixa|fixos|fixas|mensal)\b/.test(s)) return { type: "fixo", rest: s.replace(/\b(como\s+)?(gasto\s+)?(fixo|fixa|fixos|fixas|mensal)\b/g, " ") };
  if (/\b(variavel|variaveis)\b/.test(s)) return { type: "variavel", rest: s.replace(/\b(como\s+)?(gasto\s+)?(variavel|variaveis)\b/g, " ") };
  return { type: null, rest: s };
}

/** "netflix 55", "55 de netflix", "netflix por r$ 55" → { name, value }. */
function nameAndValue(part: string): { name: string; value: number } | null {
  const p = part.trim();
  let m = p.match(new RegExp(String.raw`^(.+?)(?:\s*:\s*|\s+(?:por\s+|de\s+|no valor de\s+|=\s*)?)(${N})$`));
  if (m) {
    const value = num(m[2]);
    const name = cleanName(m[1]);
    if (value !== null && name) return { name, value };
  }
  m = p.match(new RegExp(String.raw`^(${N})\s+(?:(?:referente|referentes|relativo|relativa)\s+(?:a|ao|aos|as)\s+|ref\.?\s+|para\s+(?:o\s+|a\s+)?|pro\s+|pra\s+|de\s+|do\s+|da\s+|em\s+|no\s+|na\s+|com\s+)?(.+)$`));
  if (m) {
    const value = num(m[1]);
    const name = cleanName(m[2]);
    if (value !== null && name && !/^\d/.test(name)) return { name, value };
  }
  return null;
}

/** Separa a lista de itens do grupo; "em X" sempre indica grupo, "no/na X" só se X for um grupo existente. */
function splitGroup(body: string, groups: string[]): { list: string; group: string | null } {
  const matches = [...body.matchAll(GROUP_PREP)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const after = body.slice(m.index! + m[0].length).trim();
    if (!after || /\d/.test(after)) continue;
    const strong = /^\s+(em|no grupo|na categoria|no grupo de)\s+/.test(m[0]) || /grupo\s+$/.test(m[0]);
    if (strong || findGroup(after, groups)) return { list: body.slice(0, m.index).trim(), group: cleanName(after) };
  }
  return { list: body, group: null };
}

/** Grupo no começo do pedido: "ao grupo de pagamento 98,95 referente a noroeste", "em casa: aluguel 1800". */
function leadingGroup(body: string, groups: string[]): { list: string; group: string } | null {
  const colon = body.match(/^(?:em|no|na|ao|para)\s+(?:grupo\s+)?([^:\d]+?)\s*:\s*(.+)$/);
  if (colon) return { group: cleanName(colon[1]), list: colon[2].trim() };
  const m = body.match(/^(?:(?:ao|no|na|para o|para a|pro|pra|em|dentro do|dentro da)\s+)?(?:grupo|categoria)\s+(?:de\s+|do\s+|da\s+|dos\s+|das\s+)?(.+)$/);
  if (!m) return null;
  const words = m[1].split(" ");
  const firstNum = words.findIndex((w) => /\d/.test(w));
  const maxLen = Math.min(3, firstNum === -1 ? words.length - 1 : firstNum);
  if (maxLen < 1) return null;
  const same = (a: string, b: string) => normalize(a).replace(/s$/, "") === normalize(b).replace(/s$/, "");
  let take = 1;
  for (let k = maxLen; k > 1; k--) {
    const cand = words.slice(0, k).join(" ");
    if (groups.some((g) => same(g, cand))) { take = k; break; }
  }
  const list = words.slice(take).join(" ").trim();
  return list ? { list, group: cleanName(words.slice(0, take).join(" ")) } : null;
}

/** Grupo existente logo no começo, sem a palavra "grupo": "em cartao o item 20 no valor de 38,50". */
function prefixGroup(body: string, groups: string[]): { group: string; rest: string } | null {
  const m = body.match(/^(?:em|no|na|ao|pro|pra|para o|para a|para|dentro do|dentro da)\s+(.+)$/);
  if (!m) return null;
  const words = m[1].split(" ");
  const same = (a: string, b: string) => normalize(a).replace(/s$/, "") === normalize(b).replace(/s$/, "");
  for (let k = Math.min(3, words.length - 1); k >= 1; k--) {
    const cand = words.slice(0, k).join(" ");
    if (/\d/.test(cand)) continue;
    const hit = groups.find((g) => same(g, cand)) ?? (k === 1 && cand.length >= 4 ? groups.find((g) => similar(normalize(cand), normalize(g))) : undefined);
    if (hit) return { group: cand, rest: words.slice(k).join(" ") };
  }
  return null;
}

const VALUE_CUE = String.raw`(?:(?:com|no|pelo|por)\s+(?:o\s+)?valor\s+(?:de\s+)?|valor\s+(?:de\s+)?|custando\s+|por\s+|r\$\s*|=\s*)`;

/** Acha o valor do item: o número depois de "valor de"/"por", ou o único número, ou o último quando fecha a frase. */
function pickValue(text: string): { value: number | null; text: string; ambiguous: boolean } {
  const all = [...text.matchAll(new RegExp(N, "g"))];
  if (!all.length) return { value: null, text, ambiguous: false };
  const cut = (m: RegExpMatchArray, v: string) => ({ value: num(v), text: `${text.slice(0, m.index)} ${text.slice(m.index! + m[0].length)}`, ambiguous: false });
  const cued = [...text.matchAll(new RegExp(String.raw`\s*${VALUE_CUE}(${N})(?:\s*reais)?`, "g"))].pop();
  if (cued) return cut(cued, cued[1]);
  const last = text.match(new RegExp(String.raw`\s*(?:de\s+)?(${N})(?:\s*reais)?\s*$`));
  const inName = (m: RegExpMatchArray) => /\b(?:item|numero|parcela)\s*$/.test(text.slice(0, m.index));
  if (last && all.slice(0, -1).every(inName)) return cut(last, last[1]);
  if (all.length === 1) {
    const one = text.match(new RegExp(String.raw`\s*(?:de\s+)?(${N})(?:\s*reais)?`))!;
    return cut(one, one[1]);
  }
  return { value: null, text, ambiguous: true };
}

const FILLER = /^\s*(?:(?:(?:ess[ea]|est[ea]|aquel[ea]|o|um|uma|nov[oa])\s+)?(?:item|gasto|despesa)|(?:essa|esta|aquela)\s+conta)\b\s*(?:chamad[oa]\s+|de nome\s+|com (?:o )?nome(?: de)?\s+)?/;

/**
 * Leitura por palavras-chave quando o pedido cita "grupo" em qualquer lugar:
 * "esse item no grupo cartão - noroeste com valor de 98,95". Acha o valor, o grupo e trata o resto como nome.
 */
function keywordItem(body: string, groups: string[]): { name: string; value: number | null; group: string } | null {
  const gm = body.match(/\b(?:(?:no|na|ao|para o|para a|pro|pra|em|dentro do|dentro da)\s+)?(?:grupo|categoria)\s+(?:de\s+|do\s+|da\s+)?(.+)$/);
  if (!gm) return null;
  const picked = pickValue(body);
  if (picked.ambiguous) return null;
  const { value, text } = picked;
  const g = text.match(/\b(?:(?:no|na|ao|para o|para a|pro|pra|em|dentro do|dentro da)\s+)?(?:grupo|categoria)\s+(?:de\s+|do\s+|da\s+)?(.+)$/);
  if (!g) return null;
  const before = text.slice(0, g.index).trim();
  const tail = g[1].trim();
  const sep = tail.match(/\s*(?:\s-\s|-\s|\s-|:|,|;|\s+com\s+|\s+referente\s+(?:a|ao)\s+|\s+chamad[oa]\s+|\s+de nome\s+)\s*/);
  let group: string;
  let after: string;
  if (sep && sep.index! > 0) {
    group = tail.slice(0, sep.index).trim();
    after = tail.slice(sep.index! + sep[0].length).trim();
  } else {
    const words = tail.split(" ");
    const same = (a: string, b: string) => normalize(a).replace(/s$/, "") === normalize(b).replace(/s$/, "");
    let take = 1;
    for (let k = Math.min(3, words.length); k > 1; k--) {
      if (groups.some((x) => same(x, words.slice(0, k).join(" ")))) { take = k; break; }
    }
    group = words.slice(0, take).join(" ");
    after = words.slice(take).join(" ");
  }
  let name = cleanName(
    `${before} ${after}`
      .replace(FILLER, " ")
      .replace(/^\s*(?:-|:)\s*|\s*(?:-|:)\s*$/g, " ")
      .replace(/\b(?:referente|relativo|relativa)\s+(?:a|ao|as|aos)\b/g, " ")
      .replace(/\s+com\s*$/, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).replace(/^(?:-|:)\s*/, "");
  if (/^[\d\s.,-]+$/.test(name) && /\bitem\b/.test(before)) name = `item ${name.replace(/[\s.,-]+$/, "")}`;
  return { name, value, group: cleanName(group) };
}

export function findGroup(name: string, groups: string[]): string | null {
  const n = normalize(name).replace(/^grupo\s+/, "");
  if (!n) return null;
  const norm = groups.map((g) => [g, normalize(g)] as const);
  return norm.find(([, g]) => g === n)?.[0]
    ?? norm.find(([, g]) => g.replace(/s$/, "") === n.replace(/s$/, ""))?.[0]
    ?? norm.find(([, g]) => g.startsWith(n) || n.startsWith(g))?.[0]
    ?? norm.find(([, g]) => similar(n, g))?.[0]
    ?? null;
}

function splitList(s: string): string[] {
  return s.split(/\s*(?:,(?!\d)|;|\s+e\s+(?=[a-z\d]))\s*/).map((x) => x.trim()).filter(Boolean);
}

function rateFrom(s: string): { rateMonth: number; label: string } | null {
  const cdi = s.match(new RegExp(String.raw`(${N})\s*%\s*do\s*cdi`));
  if (cdi) return null;
  const m = s.match(new RegExp(String.raw`(${N})\s*%\s*(ao mes|a\.?m\.?|mensal|por mes|ao ano|a\.?a\.?|anual|por ano)?`));
  if (!m) return null;
  const r = num(m[1]);
  if (r === null) return null;
  const anual = /ano|a\.?a|anual/.test(m[2] ?? "");
  return anual
    ? { rateMonth: Math.pow(1 + r / 100, 1 / 12) - 1, label: `${fmtPct(r)} ao ano` }
    : { rateMonth: r / 100, label: `${fmtPct(r)} ao mês` };
}

function monthsFrom(s: string): number | null {
  const m = s.match(/(\d+)\s*(meses|mes|anos|ano)\b/);
  if (!m) return null;
  return Number(m[1]) * (m[2].startsWith("ano") ? 12 : 1);
}

export function fmtPct(n: number): string {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function parseGenie(input: string, groups: string[], cdiAnual: number): GenieCommand {
  const raw = input.replace(/[−–]/g, "-");
  const orig = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  const t = normalize(raw).replace(/[?!.]+$/, "").trim();
  if (!t) return { kind: "unknown" };
  /** Trecho original (com acentos e maiúsculas) do fragmento normalizado. */
  const recover = (frag: string) => {
    const i = t.indexOf(frag);
    return i >= 0 && normalize(orig).startsWith(t) ? orig.substr(i, frag.length) : frag;
  };
  const cmd = parseNormalized(t, groups, cdiAnual);
  if (cmd.kind === "addItems") return { ...cmd, items: cmd.items.map((x) => ({ ...x, name: capitalize(recover(x.name.toLowerCase())) })), group: cmd.group && recover(cmd.group) };
  if (cmd.kind === "createGroups") return { ...cmd, names: cmd.names.map(recover) };
  if (cmd.kind === "addIncome") return { ...cmd, description: capitalize(recover(cmd.description.toLowerCase())) };
  if (cmd.kind === "spend") return { ...cmd, name: recover(cmd.name) };
  if (cmd.kind === "setPlanned") return { ...cmd, name: capitalize(recover(cmd.name)) };
  if (cmd.kind === "remove") return { ...cmd, target: recover(cmd.target) };
  if (cmd.kind === "draftItem") return { ...cmd, name: cmd.name && capitalize(recover(cmd.name)), group: cmd.group && recover(cmd.group) };
  if (cmd.kind === "draftSpend") return { ...cmd, name: recover(cmd.name) };
  if (cmd.kind === "draftIncome") return { ...cmd, description: cmd.description && capitalize(recover(cmd.description)) };
  return cmd;
}

/** Tira cortesias que não mudam o pedido: "quero", "pode", "por favor", "genio,". */
function stripPolite(t: string): string {
  let s = t;
  for (let i = 0; i < 3; i++) {
    s = s
      .replace(/^(?:ei|oi|ola|opa|genio|muvo|muvo genio)\s*[,:]?\s+/, "")
      .replace(/^(?:por favor|pfv|pf)\s*,?\s+/, "")
      .replace(/^(?:eu\s+)?(?:quero|queria|gostaria de|preciso|vou|vamos|pode|poderia|podia|consegue|me ajuda a|ajuda a|bora|tem como)\s+/, "")
      .replace(/^(?:me\s+)?(?:ajuda|ajude)\s+a\s+/, "")
      .replace(/\s*,?\s*(?:por favor|pfv|pf|obrigad[oa]|valeu)$/, "")
      .trim();
  }
  return s || t;
}

const CREATE_GROUP = /\b(?:cri[aeo]r?|crie|abr[aei]r?|mont[aeo]r?|faz(?:er)?|faca)\b.*\b(?:grupos?|categorias?)\b|\b(?:nov[oa]s?)\s+(?:grupos?|categorias?)\b|\b(?:grupos?|categorias?)\s+nov[oa]s?\b|\b(?:adiciona\w*|add|inclui\w*|coloca\w*)\s+(?:um\s+|o\s+)?(?:grupos?|categorias?)\b/;

const ACTION_WITH_VALUE = new RegExp(String.raw`^(?:${ADD_VERB}|gastei|gastamos|paguei|pagamos|comprei|compramos|lancei|recebi|entrou|ganhei|(?:muda|altera|atualiza|ajusta|troca|corrig)\w*)\b|\bagora\s+(?:e|custa|fica|vale)\b`);

/** "coloque como real", "como gasto real", "planejado e real", "já paguei" junto de um pedido de adicionar. */
const PAID = /\s*[,;-]?\s*(?:e\s+)?(?:(?:coloca(?:r)?|coloque|bota(?:r)?|bote|poe|marca(?:r)?|marque|lanca(?:r)?|lance|deixa(?:r)?|deixe)\s+)?(?:(?:tambem|ja)\s+)?(?:(?:como|no|em|com)\s+(?:o\s+)?(?:(?:planejado|previsto)\s+e\s+)?(?:gasto\s+|valor\s+)?real|(?:gasto|valor)\s+real|planejado\s+e\s+real|ja\s+(?:foi\s+)?(?:pag[oa]s?|gast[oa]s?)|ja\s+(?:paguei|gastei))\b/;

function parseNormalized(input: string, groups: string[], cdiAnual: number): GenieCommand {
  const t = canonicalize(fixTypos(stripPolite(input)));
  const paid = t.match(PAID);
  if (paid && paid.index! > 0) {
    const rest = `${t.slice(0, paid.index)} ${t.slice(paid.index! + paid[0].length)}`.replace(/\s+/g, " ").trim();
    const cmd = parseWithMath(rest, groups, cdiAnual);
    if (cmd.kind === "addItems") return { ...cmd, paid: true };
  }
  return parseWithMath(t, groups, cdiAnual);
}

function parseWithMath(t: string, groups: string[], cdiAnual: number): GenieCommand {
  if (!ACTION_WITH_VALUE.test(t) || looksLikeMath(t)) return parseRules(t, groups, cdiAnual);
  const { text, exprs } = foldMath(t);
  const cmd = parseRules(text, groups, cdiAnual);
  if (!exprs.length) return cmd;
  const calcOf = (v: number | null) => exprs.find((e) => e.value === v)?.expr;
  if (cmd.kind === "addItems") return { ...cmd, items: cmd.items.map((x) => (calcOf(x.value) ? { ...x, calc: calcOf(x.value) } : x)) };
  if ((cmd.kind === "spend" || cmd.kind === "setPlanned") && calcOf(cmd.value)) return { ...cmd, calc: calcOf(cmd.value) };
  return cmd;
}

function parseRules(t: string, groups: string[], cdiAnual: number): GenieCommand {
  if (/^(ajuda|help|o que (voce|vc) faz|o que (voce|vc) sabe( fazer)?|comandos|exemplos|como (te )?uso|como funciona)$/.test(t)) return { kind: "help" };

  // Grupo novo: basta "grupo" com criar, novo, abrir ou adicionar
  if (CREATE_GROUP.test(t) && !/\b(apag|exclu|remov|delet)/.test(t)) {
    let after = t.replace(/^.*?\b(?:grupos?|categorias?)\b\s*/, "");
    for (let i = 0; i < 3; i++) {
      after = after.replace(/^(?:nov[oa]s?|chamad[oa]s?|com (?:o )?nome(?: de)?|de nome|nome|com|de|do|da|para|pra|:|-)\s*/, "").trim();
    }
    const names = splitList(after.replace(/["“”'‘’]/g, "")).map(cleanName).filter(Boolean);
    return { kind: "createGroups", names };
  }

  // Renda pelo nome: "salário 5.000", "minha renda é 4.500"
  let m = t.match(new RegExp(String.raw`^(?:minha\s+|meu\s+)?(salario|renda|receita|freela|bonus|comissao|decimo terceiro|pro labore|pensao|aposentadoria)\s+(?:(?:do mes|deste mes|desse mes)\s+)?(?:e\s+|de\s+|foi\s+|=\s*|:\s*)?(${N})$`));
  if (m) {
    const value = num(m[2]);
    if (value !== null && value > 0) return { kind: "addIncome", description: m[1] === "renda" || m[1] === "receita" ? "Renda" : capitalize(m[1]), value };
  }

  // Apagar
  m = t.match(/^(?:apaga|apagar|apague|exclui|excluir|exclua|remove|remover|remova|deleta|deletar|delete|tira|tirar|tire)\s+(?:o\s+|a\s+)?(?:(grupo|categoria|item)\s+(?:de\s+|do\s+|da\s+)?)?(.+)$/);
  if (m) {
    const target = cleanName(m[2].replace(/["“”'‘’]/g, ""));
    if (target) return { kind: "remove", target, what: m[1] === "item" ? "item" : m[1] ? "group" : null };
  }

  // Mudar valor planejado: "muda aluguel para 1.900", "aluguel agora é 1.900"
  m = t.match(new RegExp(String.raw`^(?:muda|mudar|mude|altera|alterar|altere|atualiza|atualizar|atualize|ajusta|ajustar|ajuste|troca|trocar|troque|corrige|corrigir|corrija)\s+(?:o\s+|a\s+)?(?:valor\s+(?:planejado\s+)?(?:d[eoa]s?\s+)?)?(.+?)\s+(?:para|pra|pro|=)\s+(${N})$`))
    ?? t.match(new RegExp(String.raw`^(?:o\s+|a\s+)?(.+?)\s+agora\s+(?:e|custa|fica|vale|sera|vai ser)\s+(${N})$`));
  if (m) {
    const value = num(m[2]);
    const name = cleanName(m[1].replace(/["“”'‘’]/g, ""));
    if (value !== null && name && !/^\d/.test(name)) return { kind: "setPlanned", name, value };
  }

  // Renda
  m = t.match(new RegExp(String.raw`^(?:recebi|entrou|ganhei|(?:adiciona(?:r)?|adicione|lanca(?:r)?|lance|coloca(?:r)?)\s+(?:uma\s+)?(?:renda|receita|entrada))\s+(?:de\s+)?(?:(${N})\s*(?:de|do|da|com|como)?\s*(.*)|(.+?)\s+(?:de\s+)?(${N}))$`));
  if (m) {
    const value = num(m[1] ?? m[4]);
    const desc = cleanName(m[2] ?? m[3] ?? "") || "Renda extra";
    if (value !== null && value > 0) return { kind: "addIncome", description: capitalize(desc), value };
  }

  // Gasto real: "gastei 50 no mercado", "paguei a moto"
  m = t.match(/^(gastei|gastamos|paguei|pagamos|pago|comprei|compramos|torrei|lancei|foi|foram|(?:um\s+)?gasto de|despesa de)\s+(.+)$/);
  if (m) {
    const verb = m[1];
    let body = m[2].replace(/["“”'‘’]/g, " ").replace(/\s+/g, " ").trim();
    let value: number | null = null;
    const lead = body.match(new RegExp(String.raw`^(${N})\s+(?:reais\s+)?(?:em|no|na|nos|nas|com|de|do|da|pro|pra|para)\s+(.+)$`));
    const trail = body.match(new RegExp(String.raw`^(.+?)\s+(?:de\s+|por\s+|=\s*)?(${N})(?:\s+reais)?$`));
    if (lead) { value = num(lead[1]); body = lead[2]; }
    else if (trail) { value = num(trail[2]); body = trail[1]; }
    const { list, group } = splitGroup(body.replace(/^(?:em|no|na|nos|nas|com|pro|pra|para)\s+/, ""), groups);
    const name = cleanName(list.replace(/^(?:em|no|na|nos|nas|com|pro|pra|para)\s+/, ""));
    const g = group ? findGroup(group, groups) ?? group : null;
    if (name && !/^\d/.test(name)) {
      if (value === null && !/^pag/.test(verb)) return { kind: "draftSpend", name, group: g };
      return { kind: "spend", name, value, group: g };
    }
  }

  // Adicionar itens
  m = t.match(new RegExp(String.raw`^${ADD_VERB}\s+(.+)$`));
  const prefix = m && !/\b(?:grupo|categoria)\b/.test(m[1]) ? prefixGroup(m[1].replace(/\s+/g, " ").trim(), groups) : null;
  const keywordBody = prefix ? `${prefix.rest} no grupo ${prefix.group}` : m?.[1];
  if (m && keywordBody && /\b(?:grupo|categoria)\b/.test(keywordBody)) {
    const { type, rest } = typeOf(keywordBody.replace(/["“”'‘’]/g, " ").replace(/\s+/g, " ").trim());
    const kw = keywordItem(rest.replace(/\s+/g, " ").trim(), groups);
    if (kw) {
      if (kw.value !== null && kw.name) return { kind: "addItems", items: [{ name: capitalize(kw.name), value: kw.value, type }], group: kw.group };
      if (kw.value === null) return { kind: "draftItem", name: kw.name || null, group: kw.group };
      return { kind: "draftItem", name: null, group: kw.group };
    }
  }
  if (m && /\d/.test(m[1])) {
    const { type, rest } = typeOf(m[1].replace(/["“”'‘’]/g, " "));
    const body = rest.replace(/\s+/g, " ").trim();
    const pre = prefixGroup(body, groups);
    const lead = leadingGroup(body, groups) ?? (pre ? { list: pre.rest, group: cleanName(pre.group) } : null);
    const { list, group } = lead ?? splitGroup(body, groups);
    const items = splitList(list).map(nameAndValue).filter((x): x is { name: string; value: number } => !!x).map((x) => ({ ...x, name: capitalize(x.name), type }));
    if (items.length) return { kind: "addItems", items, group };
  }

  // Renda sem valor: "recebi", "adicionar renda"
  m = t.match(/^(?:recebi|entrou|ganhei|(?:adiciona\w*|lanca\w*|coloca\w*|inclui\w*|add)\s+(?:uma\s+|a\s+|minha\s+|meu\s+)?(?:renda|receita|entrada|salario))\b\s*(.*)$/);
  if (m && !/\d/.test(m[1])) {
    return { kind: "draftIncome", description: cleanName(m[1].replace(/^(?:o|a|meu|minha)\s+/, "")) || null };
  }

  // Item sem valor ou sem nome: o Gênio pergunta o que falta
  m = t.match(new RegExp(String.raw`^${ADD_VERB}(?:\s+(.*))?$`))
    ?? t.match(/^(?:nov[oa]\s+(?:item|gasto|despesa|conta)|(?:um\s+)?(?:item|gasto|despesa|conta)\s+nov[oa])(?:\s+(.*))?$/);
  if (m && !/\d/.test(m[1] ?? "")) {
    const body = (m[1] ?? "")
      .replace(/["“”'‘’]/g, " ")
      .replace(/^(?:um\s+|uma\s+|o\s+|a\s+)?(?:nov[oa]s?\s+)?(?:itens|item|gastos?|despesas?|contas?)\b\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    const onlyGroup = body.match(/^(?:em|no|na|ao|nos|nas|para o|para a|pro|pra)\s+(grupo\s+(?:de\s+|do\s+|da\s+)?)?(.+)$/);
    if (onlyGroup && (onlyGroup[1] || findGroup(onlyGroup[2], groups))) return { kind: "draftItem", name: null, group: cleanName(onlyGroup[2]) };
    const lead = body ? leadingGroup(body, groups) : null;
    const { list, group } = lead ?? splitGroup(body, groups);
    return { kind: "draftItem", name: cleanName(list) || null, group };
  }

  // Simulação de corte
  m = t.match(new RegExp(String.raw`(?:se eu )?(?:cortar|reduzir|diminuir|economizar)\s+(?:(${N})\s*%|(${N}))\s*(?:(?:dos|das|nos|nas|de|do|da|em|no|na)\s+)?(.+)$`));
  if (m) {
    const target = cleanName(m[3].replace(/\s*,?\s*(quanto|qual).*$/, ""));
    const pct = m[1] ? num(m[1]) : null;
    const value = m[2] ? num(m[2]) : null;
    if (target && (pct !== null || value !== null)) return { kind: "cut", pct, value, target };
  }

  // Juntar dinheiro
  m = t.match(new RegExp(String.raw`(?:juntar|guardar|economizar|ter|chegar (?:a|em))\s+(${N})\s+em\s+(\d+)\s*(meses|mes|anos|ano)`));
  if (m) {
    const total = num(m[1]);
    const months = Number(m[2]) * (m[3].startsWith("ano") ? 12 : 1);
    if (total && months) return { kind: "save", total, months, monthly: null };
  }
  m = t.match(new RegExp(String.raw`(?:quantos meses|quanto tempo).*?(?:juntar|guardar|ter|chegar (?:a|em))\s+(${N}).*?(?:guardando|economizando|poupando|com|juntando)\s+(${N})`));
  if (m) {
    const total = num(m[1]);
    const monthly = num(m[2]);
    if (total && monthly) return { kind: "save", total, months: null, monthly };
  }

  // Financiamento ou parcelado com juros
  m = t.match(new RegExp(String.raw`(?:parcela|financ\w*|emprestimo|parcelar|parcelado)\D*?(${N})\s*(?:em|por)\s*(\d+)\s*(?:x|vezes|parcelas|meses)`));
  if (m) {
    const principal = num(m[1]);
    const parcelas = Number(m[2]);
    const rate = rateFrom(t.slice(m.index! + m[0].length));
    if (principal && parcelas) return { kind: "installment", principal, parcelas, rateMonth: rate?.rateMonth ?? 0 };
  }

  // Juros compostos e rendimento
  if (/(juros compostos|rend\w*|investindo|aplicando|guardando|poupando|aportando|aplicar|investir)/.test(t) && /\d/.test(t)) {
    const months = monthsFrom(t);
    const cdi = t.match(new RegExp(String.raw`(${N})\s*%\s*do\s*cdi`));
    const rate = cdi
      ? { rateMonth: Math.pow(1 + ((num(cdi[1]) ?? 100) / 100) * (cdiAnual / 100), 1 / 12) - 1, label: `${fmtPct(num(cdi[1]) ?? 100)} do CDI` }
      : rateFrom(t);
    const monthly = num(t.match(new RegExp(String.raw`(${N})\s*(?:reais\s*)?(?:por mes|ao mes|mensal|todo mes|mensais)`))?.[1]);
    const first = num(t.match(new RegExp(String.raw`(${N})(?!\s*%)`))?.[1]);
    if (months && rate) {
      const initial = monthly !== null && first === monthly ? 0 : first ?? 0;
      if (monthly || initial) return { kind: "compound", monthly: monthly ?? 0, initial, rateMonth: rate.rateMonth, months, rateLabel: rate.label };
    }
  }

  // Divisão simples: "1200 em 12x"
  m = t.match(new RegExp(String.raw`^(?:dividir\s+)?(${N})\s+(?:em|por)\s+(\d+)\s*(?:x|vezes|parcelas|pessoas|meses)?$`));
  if (m) {
    const a = num(m[1]);
    const b = Number(m[2]);
    if (a !== null && b > 0) return { kind: "calc", expr: `${m[1]} ÷ ${b}`, value: Math.round((a / b) * 100) / 100 };
  }

  // Desconto e acréscimo: "200 com 15% de desconto"
  m = t.match(new RegExp(String.raw`(${N})\s+com\s+(${N})\s*%\s*de\s*(desconto|acrescimo|aumento|juros)`));
  if (m) {
    const a = num(m[1]);
    const p = num(m[2]);
    if (a !== null && p !== null) {
      const v = /desconto/.test(m[3]) ? a * (1 - p / 100) : a * (1 + p / 100);
      return { kind: "calc", expr: `${m[1]} ${/desconto/.test(m[3]) ? "−" : "+"} ${fmtPct(p)}`, value: Math.round(v * 100) / 100 };
    }
  }

  // Conta pura
  if (looksLikeMath(t)) {
    const body = mathBody(t);
    const value = evaluate(body);
    if (value !== null) return { kind: "calc", expr: body, value };
  }

  // Consultas ao planejamento
  if (/por dia|diari|por semana/.test(t) && /(gastar|posso|sobra|tenho)/.test(t)) return { kind: "query", topic: "dia", target: null };
  if (/sobr|saldo do mes|quanto (ainda )?(tenho|resta)|quanto fica livre/.test(t)) return { kind: "query", topic: "sobra", target: null };
  if (/maior(es)? gast|onde (mais )?gasto|gastando mais|top gastos/.test(t)) return { kind: "query", topic: "maiores", target: null };
  if (/estour|acima do planejado|passou do planejado|passei do/.test(t)) return { kind: "query", topic: "estourados", target: null };
  if (/fixos|variaveis/.test(t) && /(quanto|%|percent|parte|proporcao)/.test(t)) return { kind: "query", topic: "fixos", target: null };
  if (/(minha renda|quanto ganho|renda do mes|quanto recebo)/.test(t)) return { kind: "query", topic: "renda", target: null };
  m = t.match(/quanto (?:eu )?(?:gastei|gasto|ja gastei|foi)(?:\s+(?:em|no|na|com|de|do|da|nos|nas)\s+(.+))?/);
  if (m) return { kind: "query", topic: "gasto", target: m[1] ? cleanName(m[1]) : null };
  if (/^(resumo|meu mes|como (esta|ta) (meu|o) mes|como estou)/.test(t)) return { kind: "query", topic: "resumo", target: null };

  const single = evaluate(t);
  if (single !== null && /\d/.test(t) && /[+\-*/^%]/.test(t)) return { kind: "calc", expr: t, value: single };

  const intent = guessIntent(t);
  return (intent && fromIntent(intent, t, groups)) ?? { kind: "unknown" };
}

/** Última tentativa: o tipo de pedido veio por semelhança; valor, grupo e nome saem do que sobrou da frase. */
function fromIntent(intent: Intent, t: string, groups: string[]): GenieCommand | null {
  switch (intent) {
    case "sobra": case "dia": case "resumo": case "maiores":
      return { kind: "query", topic: intent, target: null };
    case "createGroup": {
      const { name } = extractSlots(t, [], INTENT_VERBS.createGroup);
      return { kind: "createGroups", names: name ? splitList(name) : [] };
    }
    case "remove": {
      const { name, group } = extractSlots(t, groups, INTENT_VERBS.remove);
      if (name) return { kind: "remove", target: name, what: null };
      return group ? { kind: "remove", target: group, what: "group" } : null;
    }
    case "income": {
      const { value, name } = extractSlots(t, [], INTENT_VERBS.income);
      if (value !== null && value > 0) return { kind: "addIncome", description: capitalize(name) || "Renda extra", value };
      return { kind: "draftIncome", description: name ? capitalize(name) : null };
    }
    case "spend": {
      const { value, name, group } = extractSlots(t, groups, INTENT_VERBS.spend);
      if (!name) return null;
      return value !== null ? { kind: "spend", name, value, group } : { kind: "draftSpend", name, group };
    }
    case "add": {
      const { value, name, group } = extractSlots(t, groups, INTENT_VERBS.add);
      if (name && value !== null) return { kind: "addItems", items: [{ name: capitalize(name), value, type: null }], group };
      return { kind: "draftItem", name: name ? capitalize(name) : null, group };
    }
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
