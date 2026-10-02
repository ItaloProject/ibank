"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Calculator, Check, Copy, Delete, Loader2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FALLBACK_CDI } from "@/lib/investment-rates";
import { normalize } from "@/lib/genie/calc";
import { findGroup, parseGenie, type GenieCommand, type ItemType } from "@/lib/genie/parse";
import { followUp, type GenieMemory } from "@/lib/genie/context";
import { suggest } from "@/lib/genie/suggest";
import { applyLearned, looksLikeRephrase, toTemplate, type LearnedPhrase } from "@/lib/genie/learn";
import { answer, findItem, guessType, money, plain, type GenieAnswer, type PlanSnapshot } from "@/lib/genie/answer";
import type { ExpenseGroup, ExpenseItem } from "@/components/planejamento/group-section";
import type { PlanIncome } from "@/components/planejamento/income-dialog";

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "answer"; answer: GenieAnswer }
  | {
      id: string; role: "action"; title: string; lines: string[]; undo?: () => Promise<void>; undone?: boolean;
      /** Depois do Desfazer, oferece repetir o pedido em outro grupo. */
      retry?: { cmd: Extract<GenieCommand, { kind: "addItems" | "spend" }>; fromGroup: string };
    }
  | {
      id: string; role: "pick"; prompt: string; cmd: Extract<GenieCommand, { kind: "addItems" | "spend" }>;
      done?: boolean; exclude?: string; cancelled?: boolean;
      /** Grupo do último pedido, oferecido primeiro; "sim" escolhe ele. */
      suggested?: string;
    }
  | { id: string; role: "ask"; prompt: string; hint?: string; chips?: string[] }
  | { id: string; role: "confirm"; title: string; detail: string; label: string; run: () => Promise<void>; done?: boolean }
  | { id: string; role: "learned"; said: string; means: string; phrase: string; forgotten?: boolean }
  | { id: string; role: "error"; text: string };

/** O que o Gênio perguntou e espera na próxima mensagem. */
type Pending =
  | { kind: "groupName" }
  | { kind: "item"; group: string | null }
  | { kind: "itemValue"; name: string; group: string | null }
  | { kind: "spendValue"; name: string; group: string | null }
  | { kind: "incomeValue"; description: string | null };

/** Último item mexido, para "na verdade é 110" e "mais 20 nele". */
type Target = {
  id: string; name: string; groupId: string; groupName: string; type: ItemType;
  planned: number; actual: number;
  /** Campo que o último pedido mudou; "base" é o gasto antes dele. */
  field: "planned" | "actual"; base: number;
};

type Memory = {
  target: Target | null;
  /** Itens criados no último "adicionar", para "coloque como real" valer para todos. */
  batch: Target[];
  group: string | null;
  last: GenieMemory["last"];
  income: { cmd: Extract<GenieCommand, { kind: "addIncome" }>; undo: () => Promise<void> } | null;
  /** O que veio por último: conta no visor ou mudança no planejamento. */
  recent: "calc" | "action" | null;
};

/** Combinados que valem para os próximos pedidos: grupo em foco e gasto real (para todos ou só um grupo). */
type Session = { group: string | null; real: boolean; realGroup: string | null };
const NO_SESSION: Session = { group: null, real: false, realGroup: null };

const GROUP_IDEAS = ["LAZER", "SAÚDE", "ASSINATURAS", "EDUCAÇÃO", "PETS", "VIAGEM", "FILHOS", "INVESTIMENTOS"];

type Props = {
  userId: string;
  month: string;
  monthLabel: string;
  salary: number;
  groups: ExpenseGroup[];
  items: ExpenseItem[];
  incomes: PlanIncome[];
  colors: string[];
  reloadGroups: () => Promise<void>;
  reloadItems: () => Promise<void>;
  onIncomes: (incomes: PlanIncome[]) => void;
};

const EXAMPLES = [
  "quanto posso gastar por dia?",
  "15% de 3.000",
  "adicionar Netflix 55 em Assinaturas",
  "gastei 80 no mercado",
  "criar grupo Lazer",
  "se eu cortar 20% dos variáveis?",
  "500 por mês a 1% ao mês por 2 anos",
  "parcela de 10.000 em 12x a 2% ao mês",
];

const KEYS = ["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "( )", "0", ",", "="];

const uid = () => Math.random().toString(36).slice(2, 10);

async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Não consegui salvar. Tente de novo.");
  return data as T;
}

/** Número do resultado anterior no formato que o próprio Gênio entende ("1234,5"). */
const asInput = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");

export function PlanGenie(props: Props) {
  const { userId, month, monthLabel, salary, groups, items, incomes, colors, reloadGroups, reloadItems, onIncomes } = props;
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [keypad, setKeypad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [last, setLast] = useState<{ label: string; value: string; raw: number } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const tapeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mem = useRef<Memory>({ target: null, batch: [], group: null, last: null, income: null, recent: null });
  const [session, setSessionState] = useState<Session>(NO_SESSION);
  const sessionRef = useRef<Session>(NO_SESSION);
  const setSession = (s: Session) => { sessionRef.current = s; setSessionState(s); };
  /** Lança como real quando o modo está ligado para todos ou para o grupo do item. */
  const paidIn = (groupName: string | null, explicit?: boolean) => {
    const s = sessionRef.current;
    return !!explicit || (s.real && (!s.realGroup || (!!groupName && normalize(groupName) === normalize(s.realGroup))));
  };
  const remember = (change: Partial<Memory>) => { mem.current = { ...mem.current, recent: "action", ...change }; };
  const [learned, setLearned] = useState<LearnedPhrase[]>([]);
  const learnedLoaded = useRef(false);
  /** Último pedido não entendido, para aprender se a próxima mensagem o reformular. */
  const missRef = useRef<{ text: string; at: number } | null>(null);

  useEffect(() => {
    if (!open || learnedLoaded.current) return;
    learnedLoaded.current = true;
    fetch("/api/genie/phrases")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.phrases)) setLearned(d.phrases); })
      .catch(() => {});
  }, [open]);

  function learn(miss: string, means: string) {
    const tpl = toTemplate(miss, means);
    if (!tpl) return;
    setLearned((prev) => [tpl, ...prev.filter((l) => l.phrase !== tpl.phrase)]);
    void fetch("/api/genie/phrases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tpl),
    }).catch(() => {});
    push({ id: uid(), role: "learned", said: miss, means, phrase: tpl.phrase });
  }

  function forget(msg: Extract<Msg, { role: "learned" }>) {
    setLearned((prev) => prev.filter((l) => l.phrase !== msg.phrase));
    patch(msg.id, { forgotten: true });
    void fetch(`/api/genie/phrases?phrase=${encodeURIComponent(msg.phrase)}`, { method: "DELETE" }).catch(() => {});
  }

  const snapshot: PlanSnapshot = useMemo(() => ({
    month,
    monthLabel,
    salary,
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    items: items.map((i) => ({ id: i.id, name: i.name, groupId: i.group_id, type: i.type, planned: i.planned, actual: i.actual })),
  }), [month, monthLabel, salary, groups, items]);
  const groupNames = useMemo(() => groups.map((g) => g.name), [groups]);
  const knownNames = useMemo(() => [...items.map((i) => i.name), ...groupNames], [items, groupNames]);
  const suggestions = useMemo(() => suggest(input, knownNames), [input, knownNames]);

  useEffect(() => {
    tapeRef.current?.scrollTo({ top: tapeRef.current.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [msgs, busy, reduced]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open]);

  /** Prévia ao vivo no visor enquanto a pessoa digita uma conta. */
  const preview = useMemo(() => {
    const text = withLast(input);
    if (!/\d/.test(text)) return null;
    const cmd = parseGenie(text, groupNames, FALLBACK_CDI);
    return cmd.kind === "calc" ? cmd.value : null;
  }, [input, groupNames, last]); // eslint-disable-line react-hooks/exhaustive-deps

  function withLast(text: string) {
    const t = text.trim();
    return last && /^([+\-−*/×÷^]|x\s)/.test(t) ? `${asInput(last.raw)} ${t}` : t;
  }

  const push = (...m: Msg[]) => setMsgs((prev) => [...prev, ...m]);
  const patch = (id: string, change: Partial<Msg>) =>
    setMsgs((prev) => prev.map((m) => (m.id === id ? ({ ...m, ...change } as Msg) : m)));

  function showAnswer(a: GenieAnswer) {
    push({ id: uid(), role: "answer", answer: a });
    if (a.raw !== undefined && a.value) {
      setLast({ label: a.title, value: a.value, raw: a.raw });
      mem.current = { ...mem.current, recent: "calc" };
    }
  }

  // ── Ações no planejamento ────────────────────────────────────────────────

  async function createGroup(name: string, offset = 0): Promise<ExpenseGroup> {
    return api<ExpenseGroup>("/api/plan-groups", "POST", {
      user_id: userId,
      name: name.trim().toUpperCase(),
      color: colors[(groups.length + offset) % colors.length],
    });
  }

  /** Grupo indicado (existente ou novo); null se for preciso perguntar. */
  async function resolveGroup(name: string | null): Promise<{ group: ExpenseGroup; created: boolean } | null> {
    if (name) {
      const found = findGroup(name, groupNames);
      if (found) return { group: groups.find((g) => g.name === found)!, created: false };
      return { group: await createGroup(name), created: true };
    }
    if (groups.length === 1) return { group: groups[0], created: false };
    if (groups.length === 0) return { group: await createGroup("GERAL"), created: true };
    return null;
  }

  async function addItems(input: Extract<GenieCommand, { kind: "addItems" }>) {
    const focus = sessionRef.current.group;
    const cmd = !input.group && focus && groups.some((g) => g.name === focus) ? { ...input, group: focus, bare: false } : input;
    if (!cmd.group && groups.length > 0) {
      const suggested = groups.find((g) => g.name === mem.current.group)?.name;
      if (cmd.bare || (suggested && groups.length > 1)) {
        const list = cmd.items.map((i) => `${i.name} (${money(i.value)})`).join(", ");
        const how = paidIn(suggested ?? null, cmd.paid) ? " como planejado e gasto real" : "";
        push({
          id: uid(),
          role: "pick",
          prompt: suggested ? `Adicionar ${list} em ${suggested}${how}?` : `Em qual grupo coloco ${list}${how}?`,
          cmd,
          suggested,
        });
        return;
      }
    }
    const target = await resolveGroup(cmd.group);
    if (!target) {
      const names = cmd.items.map((i) => i.name).join(", ");
      push({ id: uid(), role: "pick", prompt: `Em qual grupo coloco ${names}?`, cmd });
      return;
    }
    const { group, created } = target;
    const paid = paidIn(group.name, cmd.paid);
    const rows = await Promise.all(cmd.items.map((it) =>
      api<{ id: string }>("/api/plan-items", "POST", {
        user_id: userId, group_id: group.id, month,
        name: it.name, type: guessType(it.name, it.type), planned: it.value, actual: paid ? it.value : 0,
      }),
    ));
    if (created) await reloadGroups();
    await reloadItems();
    const batch: Target[] = cmd.items.map((it, i) => ({
      id: rows[i].id, name: it.name, groupId: group.id, groupName: group.name,
      type: guessType(it.name, it.type), planned: it.value, actual: paid ? it.value : 0, field: "planned", base: 0,
    }));
    remember({ last: "addItems", group: group.name, target: batch[batch.length - 1], batch });
    push({
      id: uid(),
      role: "action",
      title: `${created ? `Criei o grupo ${group.name} e adicionei` : "Adicionei"} ${rows.length === 1 ? "1 item" : `${rows.length} itens`}${created ? "" : ` em ${group.name}`}`,
      lines: cmd.items.map((it) => `${it.name} · ${money(it.value)} ${paid ? "planejado e gasto real" : "planejado"}${it.calc ? ` (${it.calc})` : ""} · ${guessType(it.name, it.type) === "fixo" ? "fixo" : "variável"}`),
      undo: async () => {
        await Promise.all(rows.map((r) => api(`/api/plan-items/${r.id}`, "DELETE")));
        if (created) { await api(`/api/plan-groups/${group.id}`, "DELETE"); await reloadGroups(); }
        await reloadItems();
      },
      retry: { cmd: { ...cmd, group: null }, fromGroup: group.name },
    });
  }

  async function spend(cmd: Extract<GenieCommand, { kind: "spend" }>) {
    const gid = cmd.group ? groups.find((g) => g.name === findGroup(cmd.group!, groupNames))?.id ?? null : null;
    const found = findItem(cmd.name, snapshot.items, gid);
    if (found) {
      const prev = found.actual;
      const next = cmd.value === null ? found.planned : Math.round((prev + cmd.value) * 100) / 100;
      const body = (actual: number) => ({ group_id: found.groupId, name: found.name, type: found.type, planned: found.planned, actual });
      await api(`/api/plan-items/${found.id}`, "PATCH", body(next));
      await reloadItems();
      const groupName = groups.find((g) => g.id === found.groupId)?.name ?? "";
      remember({
        last: "spend",
        group: groupName || mem.current.group,
        target: { ...found, groupName, actual: next, field: "actual", base: cmd.value === null ? 0 : prev },
      });
      const over = found.planned > 0 && next > found.planned;
      push({
        id: uid(),
        role: "action",
        title: cmd.value === null ? `${found.name} marcado como pago` : `${found.name}: + ${money(cmd.value)}`,
        lines: [
          ...(cmd.calc ? [`Conta: ${cmd.calc} = ${money(cmd.value ?? 0)}`] : []),
          `Gasto ${money(prev)} → ${money(next)}`,
          found.planned > 0 ? (over ? `Passou ${money(next - found.planned)} do planejado` : `Ainda cabe ${money(found.planned - next)}`) : "Sem valor planejado",
        ],
        undo: async () => { await api(`/api/plan-items/${found.id}`, "PATCH", body(prev)); await reloadItems(); },
      });
      return;
    }
    if (cmd.value === null) {
      showAnswer({ title: `Não encontrei "${cmd.name}" em ${monthLabel}.`, note: "Diga o valor para eu criar o item, por exemplo \"gastei 50 em " + cmd.name + "\"." });
      return;
    }
    const target = await resolveGroup(cmd.group);
    if (!target) {
      push({ id: uid(), role: "pick", prompt: `"${cmd.name}" ainda não existe. Em qual grupo eu crio?`, cmd });
      return;
    }
    const { group, created } = target;
    const row = await api<{ id: string }>("/api/plan-items", "POST", {
      user_id: userId, group_id: group.id, month,
      name: cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1), type: guessType(cmd.name, null), planned: 0, actual: cmd.value,
    });
    if (created) await reloadGroups();
    await reloadItems();
    remember({
      last: "spend",
      group: group.name,
      target: {
        id: row.id, name: cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1), groupId: group.id, groupName: group.name,
        type: guessType(cmd.name, null), planned: 0, actual: cmd.value, field: "actual", base: 0,
      },
    });
    push({
      id: uid(),
      role: "action",
      title: `Lancei ${money(cmd.value)} em ${cmd.name}`,
      lines: [...(cmd.calc ? [`Conta: ${cmd.calc} = ${money(cmd.value)}`] : []), `Item novo em ${group.name}, sem valor planejado`],
      undo: async () => {
        await api(`/api/plan-items/${row.id}`, "DELETE");
        if (created) { await api(`/api/plan-groups/${group.id}`, "DELETE"); await reloadGroups(); }
        await reloadItems();
      },
      retry: { cmd: { ...cmd, group: null }, fromGroup: group.name },
    });
  }

  async function createGroups(names: string[]) {
    const fresh = names.filter((n) => !groupNames.some((g) => normalize(g) === normalize(n)));
    const existing = names.filter((n) => !fresh.includes(n));
    if (!fresh.length) {
      showAnswer({ title: `${existing.map((n) => n.toUpperCase()).join(", ")} já ${existing.length === 1 ? "existe" : "existem"}.` });
      return;
    }
    const created: ExpenseGroup[] = [];
    for (let i = 0; i < fresh.length; i++) created.push(await createGroup(fresh[i], i));
    await reloadGroups();
    remember({ group: created[created.length - 1].name });
    push({
      id: uid(),
      role: "action",
      title: created.length === 1 ? `Grupo ${created[0].name} criado` : `${created.length} grupos criados`,
      lines: [
        ...(created.length > 1 ? [created.map((g) => g.name).join(" · ")] : []),
        ...(existing.length ? [`${existing.map((n) => n.toUpperCase()).join(", ")} já existia`] : []),
        `Agora diga, por exemplo: "adicionar cinema 60 em ${created[0].name.toLowerCase()}"`,
      ],
      undo: async () => {
        await Promise.all(created.map((g) => api(`/api/plan-groups/${g.id}`, "DELETE")));
        await reloadGroups();
        await reloadItems();
      },
    });
  }

  async function addIncome(cmd: Extract<GenieCommand, { kind: "addIncome" }>) {
    const before = new Set(incomes.map((i) => i.id));
    const { incomes: next } = await api<{ incomes: PlanIncome[] }>("/api/plan-income", "POST", {
      month, description: cmd.description, amount: cmd.value,
    });
    onIncomes(next);
    const added = next.find((i) => !before.has(i.id));
    const total = next.reduce((s, i) => s + i.amount, 0);
    const id = uid();
    const undo = added ? async () => {
      const { incomes: after } = await api<{ incomes: PlanIncome[] }>(`/api/plan-income/${added.id}`, "DELETE");
      onIncomes(after);
      patch(id, { undone: true });
      mem.current = { ...mem.current, income: null, last: null };
    } : undefined;
    remember({ last: "addIncome", income: undo ? { cmd, undo } : null });
    push({
      id,
      role: "action",
      title: `Renda: + ${money(cmd.value)} de ${cmd.description}`,
      lines: [`Renda de ${monthLabel}: ${money(total)}`],
      undo,
    });
  }

  /** Muda o planejado ou o gasto do último item mexido, com Desfazer. */
  async function setField(t: Target, field: "planned" | "actual", value: number, title: string, base = t.base) {
    const before = { planned: t.planned, actual: t.actual };
    const after = { ...before, [field]: Math.round(value * 100) / 100 };
    const body = (v: typeof before) => ({ group_id: t.groupId, name: t.name, type: t.type, ...v });
    await api(`/api/plan-items/${t.id}`, "PATCH", body(after));
    await reloadItems();
    remember({ target: { ...t, ...after, field, base } });
    const label = field === "planned" ? "Planejado" : "Gasto";
    push({
      id: uid(),
      role: "action",
      title,
      lines: [`${label} ${money(before[field])} → ${money(after[field])}${t.groupName ? ` · ${t.groupName}` : ""}`],
      undo: async () => {
        await api(`/api/plan-items/${t.id}`, "PATCH", body(before));
        await reloadItems();
        remember({ target: t });
      },
    });
  }

  /** "Na verdade é 110": corrige o último pedido. */
  async function correct(value: number) {
    const m = mem.current;
    if (m.last === "addIncome" && m.income) {
      const { cmd, undo } = m.income;
      await undo();
      return addIncome({ ...cmd, value });
    }
    const t = m.target;
    if (!t) return showAnswer({ title: "Não sei o que corrigir.", note: "Diga o item, por exemplo \"muda Netflix para 60\"." });
    const next = t.field === "actual" ? t.base + value : value;
    return setField(t, t.field, next, `${t.name}: corrigido para ${money(t.field === "actual" ? value : next)}`);
  }

  /** "Mais 20 nele": soma no último item, no mesmo campo do último pedido. */
  async function addMore(value: number) {
    const t = mem.current.target;
    if (!t) return;
    return setField(t, t.field, t[t.field] + value, `${t.name}: + ${money(value)}`, t.field === "actual" ? t.actual : t.base);
  }

  /** "Coloque como real": o gasto real dos itens recém-mexidos passa a ser o planejado. */
  async function markPaid() {
    const m = mem.current;
    const fresh = (t: Target) => {
      const row = items.find((i) => i.id === t.id);
      return row ? { ...t, name: row.name, type: row.type, planned: row.planned, actual: row.actual } : null;
    };
    const list = (m.last === "addItems" && m.batch.length ? m.batch : m.target ? [m.target] : [])
      .map(fresh)
      .filter((t): t is Target => !!t && t.planned > 0);
    if (!list.length) {
      return showAnswer({ title: "Não sei qual item marcar como gasto real.", note: "Diga o item e o valor, por exemplo \"gastei 180 na luz\"." });
    }
    const body = (t: Target, actual: number) => ({ group_id: t.groupId, name: t.name, type: t.type, planned: t.planned, actual });
    await Promise.all(list.map((t) => api(`/api/plan-items/${t.id}`, "PATCH", body(t, t.planned))));
    await reloadItems();
    const done = list.map((t) => ({ ...t, actual: t.planned, field: "actual" as const, base: t.actual }));
    remember({ target: done[done.length - 1], batch: m.last === "addItems" ? done : m.batch });
    push({
      id: uid(),
      role: "action",
      title: list.length === 1 ? `${list[0].name}: gasto real igual ao planejado` : `${list.length} itens com gasto real igual ao planejado`,
      lines: list.map((t) => `${t.name} · gasto ${money(t.actual)} → ${money(t.planned)}`),
      undo: async () => {
        await Promise.all(list.map((t) => api(`/api/plan-items/${t.id}`, "PATCH", body(t, t.actual))));
        await reloadItems();
        remember({ target: list[list.length - 1], batch: m.batch });
      },
    });
  }

  /** Pedido fora do que o Gênio sabe: registra a frase para ensinar depois e mostra exemplos. */
  function notUnderstood(text: string) {
    missRef.current = { text, at: Date.now() };
    void fetch("/api/genie/miss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, fallback: "ajuda" }),
    }).catch(() => {});
    showAnswer({
      ...answer({ kind: "help" }, snapshot)!,
      title: "Ainda não sei fazer isso. Tente assim:",
      note: "Escreva de outro jeito: se eu entender, aprendo que as duas frases querem dizer a mesma coisa.",
    });
  }

  async function remove(cmd: Extract<GenieCommand, { kind: "remove" }>) {
    const gName = cmd.what !== "item" ? findGroup(cmd.target, groupNames) : null;
    const hit = cmd.what !== "group" ? findItem(cmd.target, snapshot.items) : null;
    const item = hit && (cmd.what === "item" || !gName || normalize(hit.name) === normalize(cmd.target))
      ? items.find((i) => i.id === hit.id) ?? null
      : null;
    if (item) {
      if (item.installment_id) {
        showAnswer({ title: `${item.name} vem de um parcelamento.`, note: "Para tirar, apague o parcelamento na página Parcelamentos." });
        return;
      }
      await api(`/api/plan-items/${item.id}`, "DELETE");
      await reloadItems();
      const groupName = groups.find((g) => g.id === item.group_id)?.name ?? "";
      push({
        id: uid(),
        role: "action",
        title: `${item.name} apagado`,
        lines: [`${money(item.planned)} planejado · ${money(item.actual)} gasto${groupName ? ` · ${groupName}` : ""}`],
        undo: async () => {
          await api("/api/plan-items", "POST", {
            user_id: userId, group_id: item.group_id, month,
            name: item.name, type: item.type, planned: item.planned, actual: item.actual,
          });
          await reloadItems();
        },
      });
      return;
    }
    const group = gName ? groups.find((g) => g.name === gName) : null;
    if (group) {
      const count = items.filter((i) => i.group_id === group.id).length;
      push({
        id: uid(),
        role: "confirm",
        title: `Apagar o grupo ${group.name}?`,
        detail: `${count ? `Os ${count} ${count === 1 ? "item" : "itens"} dele em ${monthLabel} e os` : "Os"} itens dele nos outros meses também serão apagados. Isso não dá para desfazer.`,
        label: "Apagar grupo",
        run: async () => {
          await api(`/api/plan-groups/${group.id}`, "DELETE");
          await reloadGroups();
          await reloadItems();
          push({ id: uid(), role: "action", title: `Grupo ${group.name} apagado`, lines: [] });
        },
      });
      return;
    }
    showAnswer({ title: `Não encontrei "${cmd.target}" em ${monthLabel}.`, note: "Confira o nome do item ou do grupo." });
  }

  async function setPlanned(cmd: Extract<GenieCommand, { kind: "setPlanned" }>) {
    const found = findItem(cmd.name, snapshot.items);
    if (!found) return addItems({ kind: "addItems", items: [{ name: cmd.name, value: cmd.value, type: null }], group: null });
    const prev = found.planned;
    const body = (planned: number) => ({ group_id: found.groupId, name: found.name, type: found.type, planned, actual: found.actual });
    await api(`/api/plan-items/${found.id}`, "PATCH", body(cmd.value));
    await reloadItems();
    const groupName = groups.find((g) => g.id === found.groupId)?.name ?? "";
    remember({ last: "setPlanned", group: groupName || mem.current.group, target: { ...found, groupName, planned: cmd.value, field: "planned", base: 0 } });
    push({
      id: uid(),
      role: "action",
      title: `${found.name}: planejado agora é ${money(cmd.value)}`,
      lines: [...(cmd.calc ? [`Conta: ${cmd.calc} = ${money(cmd.value)}`] : []), `Antes ${money(prev)} · diferença ${cmd.value >= prev ? "+" : "−"} ${money(Math.abs(cmd.value - prev))}`],
      undo: async () => { await api(`/api/plan-items/${found.id}`, "PATCH", body(prev)); await reloadItems(); },
    });
  }

  function ask(next: Pending, prompt: string, hint?: string, chips?: string[]) {
    setPending(next);
    push({ id: uid(), role: "ask", prompt, hint, chips });
  }

  async function run(cmd: GenieCommand, text: string) {
    switch (cmd.kind) {
      case "addItems": return addItems(cmd);
      case "spend": return spend(cmd);
      case "createGroups":
        if (!cmd.names.length) {
          const ideas = GROUP_IDEAS.filter((g) => !groupNames.some((n) => normalize(n) === normalize(g))).slice(0, 5);
          return ask({ kind: "groupName" }, "Qual o nome do grupo?", "Pode mandar mais de um: \"Lazer e Saúde\".", ideas);
        }
        return createGroups(cmd.names);
      case "addIncome": return addIncome(cmd);
      case "remove": return remove(cmd);
      case "setPlanned": return setPlanned(cmd);
      case "draftItem":
        if (!cmd.name) return ask({ kind: "item", group: cmd.group }, `Qual item e quanto planejar${cmd.group ? ` em ${cmd.group.toUpperCase()}` : ""}?`, "Exemplo: Netflix 55. Pode mandar vários: Netflix 55, Spotify 22.");
        return ask({ kind: "itemValue", name: cmd.name, group: cmd.group }, `Quanto planejar para ${cmd.name}?`, "Só o valor, por exemplo 55.");
      case "draftSpend":
        return ask({ kind: "spendValue", name: cmd.name, group: cmd.group }, `Quanto você gastou em ${cmd.name}?`, "Só o valor, por exemplo 80.");
      case "draftIncome":
        return ask({ kind: "incomeValue", description: cmd.description }, `Qual o valor${cmd.description ? ` de ${cmd.description}` : " da renda"}?`, cmd.description ? "Só o valor, por exemplo 5.000." : "Exemplo: 5.000 de salário.");
      case "realMode": {
        const focus = sessionRef.current.group;
        setSession({ ...sessionRef.current, real: cmd.on, realGroup: cmd.on ? focus : null });
        return showAnswer(cmd.on
          ? {
            title: `Combinado: os próximos itens${focus ? ` de ${focus}` : ""} entram como planejado e gasto real.`,
            note: "Para parar, diga \"voltar ao planejado\" ou toque em Parar, acima do campo.",
          }
          : { title: "Pronto: os próximos itens entram só como planejado." });
      }
      case "focus": {
        const s = sessionRef.current;
        if (cmd.reset) {
          setSession(NO_SESSION);
          return showAnswer({ title: "De volta ao normal: sem grupo fixo e itens só como planejado." });
        }
        if (!cmd.group) {
          setSession({ group: null, real: s.realGroup ? false : s.real, realGroup: null });
          return showAnswer({ title: s.group ? `Saí de ${s.group}. Vou perguntar o grupo de novo.` : "Não havia grupo fixo." });
        }
        const found = findGroup(cmd.group, groupNames);
        if (!found) return showAnswer({ title: `Não encontrei o grupo ${cmd.group}.`, note: "Crie antes com \"criar grupo " + cmd.group + "\"." });
        setSession(cmd.real ? { group: found, real: true, realGroup: found } : { ...s, group: found });
        remember({ group: found });
        return showAnswer({
          title: `Combinado: os próximos itens vão para ${found}${cmd.real ? " como planejado e gasto real" : ""}.`,
          note: `É só mandar nome e valor, por exemplo "Netflix 55". Para sair, diga "sair de ${found.toLowerCase()}" ou toque em Parar.`,
        });
      }
      case "unknown": return notUnderstood(text);
      default: {
        const a = answer(cmd, snapshot);
        if (a) showAnswer(a);
      }
    }
  }

  /** Junta a resposta curta ("Lazer", "55") ao que o Gênio tinha perguntado. */
  function complete(p: Pending, text: string, cmd: GenieCommand): string | null {
    const value = cmd.kind === "calc" ? asInput(cmd.value) : text;
    const inGroup = (g: string | null) => (g ? ` em ${g}` : "");
    switch (p.kind) {
      case "groupName": return cmd.kind === "unknown" ? `criar grupo ${text}` : null;
      case "item": return cmd.kind === "unknown" || cmd.kind === "addItems" ? `adicionar ${text}${cmd.kind === "addItems" && cmd.group ? "" : inGroup(p.group)}` : null;
      case "itemValue": return cmd.kind === "unknown" || cmd.kind === "calc" ? `adicionar ${p.name} ${value}${inGroup(p.group)}` : null;
      case "spendValue": return cmd.kind === "unknown" || cmd.kind === "calc" ? `gastei ${value} em ${p.name}${inGroup(p.group)}` : null;
      case "incomeValue": return cmd.kind === "unknown" || cmd.kind === "calc" ? `recebi ${value}${p.description ? ` de ${p.description}` : ""}` : null;
    }
  }

  async function send(raw?: string) {
    const text = withLast(raw ?? input);
    if (!text || busy) return;
    setInput("");
    push({ id: uid(), role: "user", text });
    setBusy(true);
    try {
      const openPick = pending ? undefined : [...msgs].reverse().find((m): m is Extract<Msg, { role: "pick" }> => m.role === "pick" && !m.done && !m.cancelled);
      if (openPick) {
        const n = normalize(text).replace(/[?!.]+$/, "");
        const named = n.length >= 3 && n.split(" ").length <= 3 ? findGroup(n.replace(/^(?:em|no|na|no grupo|grupo)\s+/, ""), groupNames) : null;
        if (/^(?:sim|s|ss|pode|pode ser|isso|ok|okay|beleza|blz|manda|confirma|confirmo|claro|aham|esse|nesse|nele|la|ali|isso mesmo)$/.test(n) && openPick.suggested) {
          patch(openPick.id, { done: true });
          return await run({ ...openPick.cmd, group: openPick.suggested }, "");
        }
        if (/^(?:nao|n|outro|outro grupo|em outro|noutro)$/.test(n) && openPick.suggested) {
          patch(openPick.id, { cancelled: true });
          push({ id: uid(), role: "pick", prompt: "Em qual grupo, então?", cmd: openPick.cmd, exclude: openPick.suggested });
          return;
        }
        if (/^(?:cancela|cancelar|esquece|deixa|deixa pra la)$/.test(n)) {
          patch(openPick.id, { cancelled: true });
          return showAnswer({ title: "Cancelado. Nada foi adicionado." });
        }
        if (named) {
          patch(openPick.id, { done: true });
          return await run({ ...openPick.cmd, group: named }, "");
        }
      }
      const miss = missRef.current;
      missRef.current = null;
      const fromLearned = pending ? null : applyLearned(text, learned);
      let said = fromLearned ?? text;
      if (!pending) {
        const m = mem.current;
        const afterAction = m.recent === "action";
        const fu = followUp(said, {
          item: afterAction ? m.target?.name ?? null : null,
          group: m.group,
          last: afterAction ? m.last : null,
        });
        if (fu?.kind === "correct") return await correct(fu.value);
        if (fu?.kind === "more") return await addMore(fu.value);
        if (fu?.kind === "paid") return await markPaid();
        if (fu?.kind === "text") said = fu.text;
      }
      let cmd = parseGenie(said, groupNames, FALLBACK_CDI);
      if (pending && (pending.kind === "itemValue" || pending.kind === "spendValue" || pending.kind === "incomeValue") && cmd.kind === "unknown" && !/\d/.test(text)) {
        if (/^(?:cancela|cancelar|esquece|deixa)/.test(normalize(text))) { setPending(null); return showAnswer({ title: "Cancelado." }); }
        push({ id: uid(), role: "ask", prompt: "Não entendi o valor.", hint: "Mande só o número, por exemplo 80. Para desistir, diga cancelar." });
        return;
      }
      if (pending) {
        const joined = complete(pending, text, cmd);
        setPending(null);
        if (joined) cmd = parseGenie(joined, groupNames, FALLBACK_CDI);
      }
      await run(cmd, text);
      const understood = cmd.kind !== "unknown" && cmd.kind !== "help";
      if (miss && understood && !pending && !fromLearned && Date.now() - miss.at < 3 * 60_000 && looksLikeRephrase(miss.text, said)) {
        learn(miss.text, said);
      }
    } catch (err) {
      push({ id: uid(), role: "error", text: err instanceof Error ? err.message : "Algo deu errado. Tente de novo." });
    } finally {
      setBusy(false);
    }
  }

  async function pickGroup(msg: Extract<Msg, { role: "pick" }>, groupName: string) {
    if (busy || msg.done) return;
    patch(msg.id, { done: true });
    setBusy(true);
    try {
      await run({ ...msg.cmd, group: groupName }, "");
    } catch (err) {
      push({ id: uid(), role: "error", text: err instanceof Error ? err.message : "Algo deu errado. Tente de novo." });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(msg: Extract<Msg, { role: "confirm" }>) {
    if (busy || msg.done) return;
    patch(msg.id, { done: true });
    setBusy(true);
    try {
      await msg.run();
    } catch (err) {
      push({ id: uid(), role: "error", text: err instanceof Error ? err.message : "Algo deu errado. Tente de novo." });
    } finally {
      setBusy(false);
    }
  }

  async function undo(msg: Extract<Msg, { role: "action" }>) {
    if (!msg.undo || msg.undone || busy) return;
    setBusy(true);
    try {
      await msg.undo();
      patch(msg.id, { undone: true });
      if (msg.retry && groups.some((g) => g.name !== msg.retry!.fromGroup)) {
        push({ id: uid(), role: "pick", prompt: "Desfeito. Quer colocar em outro grupo?", cmd: msg.retry.cmd, exclude: msg.retry.fromGroup });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui desfazer.");
    } finally {
      setBusy(false);
    }
  }

  function press(key: string) {
    if (key === "=") { void send(); return; }
    if (key === "C") { setInput(""); setLast(null); return; }
    if (key === "⌫") { setInput((v) => v.slice(0, -1)); return; }
    if (key === "( )") {
      setInput((v) => {
        const opened = (v.match(/\(/g) ?? []).length - (v.match(/\)/g) ?? []).length;
        return v + (opened > 0 && /[\d)%]\s*$/.test(v) ? ")" : "(");
      });
      return;
    }
    const op = /^[+−×÷]$/.test(key);
    setInput((v) => (op ? `${v.trimEnd()} ${key} ` : v + key));
  }

  const lastAskId = [...msgs].reverse().find((m) => m.role === "ask")?.id;

  const display = preview !== null
    ? { label: withLast(input), value: plain(preview), live: true }
    : last ? { label: last.label, value: last.value, live: false } : null;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar Muvo Gênio" : "Abrir Muvo Gênio, a calculadora do planejamento"}
        aria-expanded={open}
        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className={cn(
          "fixed z-40 right-[max(1rem,var(--safe-right))] bottom-[calc(var(--bottom-nav-offset)+0.75rem)] md:bottom-5 md:right-5",
          "flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-foreground bg-white shadow-2xl touch-manipulation",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        {open
          ? <X className="h-6 w-6 text-black" aria-hidden="true" />
          : <Image src="/bot/genio-avatar.webp" alt="" width={56} height={56} className="h-full w-full object-cover" priority />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Muvo Gênio"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed z-40 flex flex-col overflow-hidden rounded-3xl border bg-background shadow-2xl",
              "inset-x-2 bottom-[calc(var(--bottom-nav-offset)+5rem)] h-[min(78dvh,680px)] max-h-[calc(100dvh_-_var(--bottom-nav-offset)_-_6rem)]",
              "md:inset-x-auto md:right-5 md:bottom-[5.5rem] md:w-[400px] md:origin-bottom-right",
            )}
          >
            {/* Cabeçalho */}
            <header className="flex items-center gap-3 border-b px-4 py-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-foreground bg-white">
                <Image src="/bot/genio-avatar.webp" alt="" width={40} height={40} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-medium leading-tight tracking-tight">Muvo Gênio</p>
                <p className="truncate text-[11px] text-muted-foreground">Calcula e organiza <span className="capitalize">{monthLabel}</span></p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Fita de cálculos e conversas */}
            <div ref={tapeRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-2.5" aria-live="polite">
              {msgs.length === 0 ? (
                <div className="flex flex-col items-center pt-2 text-center">
                  <Image src="/bot/genio-lampada-full.webp" alt="Mascote do Muvo Gênio: um rato de óculos escuros e terno saindo de uma lâmpada mágica" width={720} height={931} className="h-40 w-auto select-none" />
                  <p className="mt-3 font-display text-lg font-black tracking-tight">Peça uma conta ou uma mudança</p>
                  <p className="mt-1 max-w-[30ch] text-xs text-muted-foreground">Eu faço contas, simulo juros e parcelas, e mexo no seu planejamento por texto. Tudo que eu mudar tem Desfazer.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => send(ex)}
                        className="min-h-9 rounded-full border px-3 text-[11px] font-medium text-foreground/80 transition-colors hover:border-foreground/40 hover:bg-muted hover:text-foreground"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                msgs.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <MessageView
                      msg={m}
                      groups={groups}
                      busy={busy}
                      active={!!pending && m.id === lastAskId}
                      onPick={pickGroup}
                      onCancel={(p) => patch(p.id, { done: true, cancelled: true })}
                      onUndo={undo}
                      onConfirm={confirm}
                      onForget={forget}
                      onChip={(c) => send(c)}
                    />
                  </motion.div>
                ))
              )}
              {busy && (
                <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Calculando…
                </div>
              )}
            </div>

            {/* Visor */}
            <div className="mx-3 mb-2 rounded-2xl bg-foreground px-4 py-3 text-background dark:border dark:border-white/10 dark:bg-white/5 dark:text-foreground">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[11px] text-background/60 dark:text-muted-foreground">
                  {display ? display.label : "Visor"}
                </p>
                {display && !display.live && (
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard?.writeText(display.value); toast.success("Copiado"); }}
                    aria-label="Copiar resultado"
                    className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-background/60 hover:text-background dark:text-muted-foreground dark:hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className={cn(
                "mt-0.5 text-right font-display font-black tabular-nums leading-none tracking-tight transition-opacity",
                (display?.value.length ?? 0) > 14 ? "text-2xl" : "text-4xl",
                display?.live && "opacity-70",
              )}>
                {display ? (display.live ? `= ${display.value}` : display.value) : "0"}
              </p>
            </div>

            {(session.group || session.real) && (
              <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-1 pl-3 pr-1 text-xs">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 font-medium">
                  {!session.group
                    ? "Itens novos entram como planejado e gasto real"
                    : `Itens novos vão para ${session.group}${
                      !session.real ? "" : !session.realGroup || session.realGroup === session.group ? ", como planejado e gasto real" : ` · gasto real só em ${session.realGroup}`
                    }`}
                </span>
                <button
                  type="button"
                  onClick={() => { setSession(NO_SESSION); showAnswer({ title: "De volta ao normal: sem grupo fixo e itens só como planejado." }); }}
                  className="min-h-9 shrink-0 rounded-lg px-3 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Parar
                </button>
              </div>
            )}

            {suggestions.length > 0 && !busy && (
              <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none]" aria-label="Sugestões">
                {suggestions.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => { setInput(s.value); inputRef.current?.focus(); }}
                    className="min-h-9 shrink-0 rounded-full border bg-muted/40 px-3 text-xs font-semibold transition-colors hover:bg-muted"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Entrada */}
            <form
              onSubmit={(e) => { e.preventDefault(); void send(); }}
              className="flex items-center gap-1.5 border-t px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => setKeypad((v) => !v)}
                aria-label={keypad ? "Esconder teclado da calculadora" : "Mostrar teclado da calculadora"}
                aria-pressed={keypad}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                  keypad ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Calculator className="h-5 w-5" />
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={pending ? "Responda aqui…" : last ? "Continue a conta: + 10%, × 12…" : "Conta ou pedido…"}
                aria-label="Conta ou pedido para o Muvo Gênio"
                enterKeyHint="send"
                autoComplete="off"
                className="h-11 min-w-0 flex-1 rounded-full border bg-muted/30 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/40"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="Enviar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-30"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </form>

            <AnimatePresence initial={false}>
              {keypad && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-4 gap-1.5 px-3 pb-3">
                    {KEYS.map((k) => {
                      const op = /^[+−×÷%=]$/.test(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => press(k)}
                          aria-label={k === "⌫" ? "Apagar" : k === "C" ? "Limpar" : k === "( )" ? "Parênteses" : k}
                          className={cn(
                            "flex h-11 items-center justify-center rounded-xl font-display text-lg font-bold tabular-nums transition-colors active:scale-95",
                            k === "=" ? "bg-foreground text-background hover:bg-foreground/90"
                              : op ? "bg-muted text-foreground hover:bg-muted/70"
                              : k === "C" || k === "⌫" ? "text-muted-foreground hover:bg-muted"
                              : "border hover:bg-muted",
                          )}
                        >
                          {k === "⌫" ? <Delete className="h-5 w-5" /> : k}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageView({
  msg, groups, busy, active, onPick, onCancel, onUndo, onConfirm, onForget, onChip,
}: {
  onForget: (m: Extract<Msg, { role: "learned" }>) => void;
  msg: Msg;
  groups: ExpenseGroup[];
  busy: boolean;
  active: boolean;
  onPick: (m: Extract<Msg, { role: "pick" }>, group: string) => void;
  onCancel: (m: Extract<Msg, { role: "pick" }>) => void;
  onUndo: (m: Extract<Msg, { role: "action" }>) => void;
  onConfirm: (m: Extract<Msg, { role: "confirm" }>) => void;
  onChip: (text: string) => void;
}) {
  switch (msg.role) {
    case "ask":
      return (
        <div className="flex gap-2">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border bg-white">
            <Image src="/bot/genio-avatar.webp" alt="" width={28} height={28} className="h-full w-full object-cover" />
          </div>
          <div className={cn("min-w-0 flex-1 rounded-2xl rounded-tl-md border px-3.5 py-2.5", active && "border-foreground/40")}>
            <p className="text-sm font-semibold">{msg.prompt}</p>
            {msg.hint && <p className="mt-0.5 text-xs text-muted-foreground">{msg.hint}</p>}
            {active && msg.chips && msg.chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {msg.chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={busy}
                    onClick={() => onChip(c)}
                    className="min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );

    case "confirm":
      return (
        <div className="rounded-2xl border border-destructive/30 px-3.5 py-3">
          <p className="text-sm font-semibold">{msg.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{msg.detail}</p>
          <div className="mt-2 flex justify-end">
            {msg.done
              ? <span className="text-[11px] font-medium text-muted-foreground">Confirmado</span>
              : (
                <button
                  type="button"
                  onClick={() => onConfirm(msg)}
                  disabled={busy}
                  className="inline-flex min-h-9 items-center rounded-full bg-destructive px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {msg.label}
                </button>
              )}
          </div>
        </div>
      );

    case "user":
      return (
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3 py-2 text-sm [overflow-wrap:anywhere]">{msg.text}</p>
        </div>
      );

    case "answer": {
      const a = msg.answer;
      const toneText = a.tone === "good" ? "text-green-600 dark:text-green-400" : a.tone === "bad" ? "text-destructive" : "";
      return (
        <div className="rounded-2xl border px-3.5 py-3">
          <p className="text-xs text-muted-foreground">{a.title}</p>
          {a.value && <p className={cn("mt-0.5 font-display text-2xl font-black tabular-nums tracking-tight", toneText)}>{a.value}</p>}
          {a.lines && a.lines.length > 0 && (() => {
            const stacked = a.lines.some((l) => l.value.length > 28);
            return (
              <dl className={cn("mt-2 border-t pt-2", stacked ? "space-y-2" : "space-y-1")}>
                {a.lines.map((l, i) => (
                  <div key={i} className={cn("text-xs", stacked ? "flex flex-col gap-0.5" : "flex items-baseline justify-between gap-3")}>
                    <dt className={cn("text-muted-foreground", stacked ? "text-[11px]" : "shrink-0 whitespace-nowrap")}>{l.label}</dt>
                    <dd className={cn(
                      "min-w-0 font-semibold tabular-nums [overflow-wrap:anywhere]",
                      !stacked && "text-right",
                      l.tone === "good" && "text-green-600 dark:text-green-400",
                      l.tone === "bad" && "text-destructive",
                    )}>{l.value}</dd>
                  </div>
                ))}
              </dl>
            );
          })()}
          {a.note && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{a.note}</p>}
        </div>
      );
    }

    case "action":
      return (
        <div className={cn("rounded-2xl border px-3.5 py-3 transition-opacity", msg.undone && "opacity-55")}>
          <div className="flex items-start gap-2.5">
            <span className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              msg.undone ? "bg-muted text-muted-foreground" : "bg-foreground text-background",
            )}>
              {msg.undone ? <Undo2 className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-semibold", msg.undone && "line-through")}>{msg.title}</p>
              {msg.lines.map((l, i) => <p key={i} className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{l}</p>)}
            </div>
          </div>
          {msg.undo && (
            <div className="mt-2 flex justify-end">
              {msg.undone
                ? <span className="text-[11px] font-medium text-muted-foreground">Desfeito</span>
                : (
                  <button
                    type="button"
                    onClick={() => onUndo(msg)}
                    disabled={busy}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Desfazer
                  </button>
                )}
            </div>
          )}
        </div>
      );

    case "pick":
      return (
        <div className="rounded-2xl border px-3.5 py-3">
          <p className="text-sm">{msg.prompt}</p>
          {msg.suggested && !msg.done && !msg.cancelled && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">Toque no grupo ou responda &quot;sim&quot;. Para trocar, diga o nome de outro grupo.</p>
          )}
          {msg.cancelled ? (
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">Cancelado</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {groups
                .filter((g) => g.name !== msg.exclude)
                .sort((a, b) => Number(b.name === msg.suggested) - Number(a.name === msg.suggested))
                .map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={msg.done || busy}
                  onClick={() => onPick(msg, g.name)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50",
                    g.name === msg.suggested ? "border-foreground bg-foreground text-background hover:bg-foreground/90" : "hover:bg-muted",
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.name}
                </button>
              ))}
              {!msg.done && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCancel(msg)}
                  className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>
      );

    case "learned":
      return (
        <div className={cn("rounded-2xl border border-dashed px-3.5 py-2.5 transition-opacity", msg.forgotten && "opacity-55")}>
          <p className="text-xs text-muted-foreground">
            {msg.forgotten ? "Esqueci. " : "Aprendi: "}
            quando você disser <span className="font-semibold text-foreground">&ldquo;{msg.said}&rdquo;</span>, eu entendo{" "}
            <span className="font-semibold text-foreground">&ldquo;{msg.means}&rdquo;</span>.
            {!msg.forgotten && " Os valores podem mudar."}
          </p>
          {!msg.forgotten && (
            <div className="mt-1.5 flex justify-end">
              <button
                type="button"
                onClick={() => onForget(msg)}
                className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Esquecer
              </button>
            </div>
          )}
        </div>
      );

    case "error":
      return <p className="rounded-2xl border border-destructive/30 px-3.5 py-2.5 text-xs text-destructive">{msg.text}</p>;
  }
}
