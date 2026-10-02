import { NUMBER_RE, evaluate, looksLikeMath, mathBody, normalize, parseNumber } from "./calc";

export type ItemType = "fixo" | "variavel";
export type NewItem = { name: string; value: number; type: ItemType | null };

export type GenieCommand =
  | { kind: "calc"; expr: string; value: number }
  | { kind: "addItems"; items: NewItem[]; group: string | null }
  | { kind: "spend"; name: string; value: number | null; group: string | null }
  | { kind: "createGroups"; names: string[] }
  | { kind: "addIncome"; description: string; value: number }
  | { kind: "query"; topic: "sobra" | "dia" | "gasto" | "renda" | "fixos" | "maiores" | "estourados" | "resumo"; target: string | null }
  | { kind: "cut"; pct: number | null; value: number | null; target: string }
  | { kind: "save"; total: number; months: number | null; monthly: number | null }
  | { kind: "compound"; monthly: number; initial: number; rateMonth: number; months: number; rateLabel: string }
  | { kind: "installment"; principal: number; parcelas: number; rateMonth: number }
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
  let m = p.match(new RegExp(String.raw`^(.+?)\s+(?:por\s+|de\s+|no valor de\s+|=\s*)?(${N})$`));
  if (m) {
    const value = num(m[2]);
    const name = cleanName(m[1]);
    if (value !== null && name) return { name, value };
  }
  m = p.match(new RegExp(String.raw`^(${N})\s+(?:de\s+|do\s+|da\s+|em\s+|no\s+|na\s+|com\s+)?(.+)$`));
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

export function findGroup(name: string, groups: string[]): string | null {
  const n = normalize(name).replace(/^grupo\s+/, "");
  if (!n) return null;
  const norm = groups.map((g) => [g, normalize(g)] as const);
  return norm.find(([, g]) => g === n)?.[0]
    ?? norm.find(([, g]) => g.replace(/s$/, "") === n.replace(/s$/, ""))?.[0]
    ?? norm.find(([, g]) => g.startsWith(n) || n.startsWith(g))?.[0]
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
  return cmd;
}

function parseNormalized(t: string, groups: string[], cdiAnual: number): GenieCommand {
  if (/^(ajuda|help|o que (voce|vc) faz|comandos|exemplos)$/.test(t)) return { kind: "help" };

  // Grupo novo
  let m = t.match(/^(?:cria(?:r)?|crie|novo|nova|adiciona(?:r)?|adicione|faz(?:er)?|abre|abrir)\s+(?:um\s+|o\s+|os\s+)?(?:novo\s+|nova\s+)?(?:grupos?|categorias?)\s+(?:de\s+|chamad[oa]s?\s+)?(.+)$/);
  if (m) {
    const names = splitList(m[1]).map(cleanName).filter((x) => x && !/\d/.test(x));
    if (names.length) return { kind: "createGroups", names };
  }

  // Renda
  m = t.match(new RegExp(String.raw`^(?:recebi|entrou|ganhei|(?:adiciona(?:r)?|adicione|lanca(?:r)?|lance|coloca(?:r)?)\s+(?:uma\s+)?(?:renda|receita|entrada))\s+(?:de\s+)?(?:(${N})\s*(?:de|do|da|com|como)?\s*(.*)|(.+?)\s+(?:de\s+)?(${N}))$`));
  if (m) {
    const value = num(m[1] ?? m[4]);
    const desc = cleanName(m[2] ?? m[3] ?? "") || "Renda extra";
    if (value !== null && value > 0) return { kind: "addIncome", description: capitalize(desc), value };
  }

  // Gasto real: "gastei 50 no mercado", "paguei a moto"
  m = t.match(new RegExp(String.raw`^(?:gastei|paguei|comprei|torrei|foi|foram)\s+(?:(${N})\s+(?:reais\s+)?(?:em|no|na|nos|nas|com|de|do|da|pro|pra)\s+)?(.+)$`));
  if (m) {
    const value = num(m[1]);
    const { list, group } = splitGroup(m[2], groups);
    const name = cleanName(list);
    if (name && !/^\d/.test(name)) return { kind: "spend", name, value, group: group ? findGroup(group, groups) ?? group : null };
  }

  // Adicionar itens
  m = t.match(new RegExp(String.raw`^${ADD_VERB}\s+(.+)$`));
  if (m && /\d/.test(m[1])) {
    const { type, rest } = typeOf(m[1]);
    const { list, group } = splitGroup(rest.replace(/\s+/g, " ").trim(), groups);
    const items = splitList(list).map(nameAndValue).filter((x): x is { name: string; value: number } => !!x).map((x) => ({ ...x, name: capitalize(x.name), type }));
    if (items.length) return { kind: "addItems", items, group };
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
  return { kind: "unknown" };
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
