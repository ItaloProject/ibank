"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Calculator, Check, Copy, Delete, Loader2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import { FALLBACK_CDI } from "@/lib/investment-rates";
import { readBotPageContext, useBotPageContext } from "@/lib/bot-page-context";
import { normalize } from "@/lib/genie/calc";
import { findGroup, parseGenie, type GenieCommand } from "@/lib/genie/parse";
import { answer, findItem, guessType, money, plain, type GenieAnswer, type PlanSnapshot } from "@/lib/genie/answer";
import type { ExpenseGroup, ExpenseItem } from "@/components/planejamento/group-section";
import type { PlanIncome } from "@/components/planejamento/income-dialog";

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "answer"; answer: GenieAnswer }
  | { id: string; role: "action"; title: string; lines: string[]; undo?: () => Promise<void>; undone?: boolean }
  | { id: string; role: "pick"; prompt: string; cmd: Extract<GenieCommand, { kind: "addItems" | "spend" }>; done?: boolean }
  | { id: string; role: "ai"; text: string }
  | { id: string; role: "error"; text: string };

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

/** Número do resultado anterior no formato que o próprio Gênio entende ("1234,5"). */
const asInput = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");

export function PlanGenie(props: Props) {
  const { userId, month, monthLabel, salary, groups, items, incomes, colors, reloadGroups, reloadItems, onIncomes } = props;
  const { botEnabled } = useUser();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [keypad, setKeypad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [last, setLast] = useState<{ label: string; value: string; raw: number } | null>(null);
  const tapeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const snapshot: PlanSnapshot = useMemo(() => ({
    month,
    monthLabel,
    salary,
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    items: items.map((i) => ({ id: i.id, name: i.name, groupId: i.group_id, type: i.type, planned: i.planned, actual: i.actual })),
  }), [month, monthLabel, salary, groups, items]);
  const groupNames = useMemo(() => groups.map((g) => g.name), [groups]);

  useBotPageContext("planejamento", {
    mes: monthLabel,
    renda: salary,
    receitas: incomes.slice(0, 8).map((i) => [i.description.slice(0, 24), i.amount]),
    grupos: groups.slice(0, 12).map((g) => ({
      nome: g.name.slice(0, 24),
      itens: items.filter((i) => i.group_id === g.id).slice(0, 10).map((i) => [i.name.slice(0, 22), i.type, i.planned, i.actual]),
    })),
  });

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
    if (a.raw !== undefined && a.value) setLast({ label: a.title, value: a.value, raw: a.raw });
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

  async function addItems(cmd: Extract<GenieCommand, { kind: "addItems" }>) {
    const target = await resolveGroup(cmd.group);
    if (!target) {
      const names = cmd.items.map((i) => i.name).join(", ");
      push({ id: uid(), role: "pick", prompt: `Em qual grupo coloco ${names}?`, cmd });
      return;
    }
    const { group, created } = target;
    const rows = await Promise.all(cmd.items.map((it) =>
      api<{ id: string }>("/api/plan-items", "POST", {
        user_id: userId, group_id: group.id, month,
        name: it.name, type: guessType(it.name, it.type), planned: it.value, actual: 0,
      }),
    ));
    if (created) await reloadGroups();
    await reloadItems();
    push({
      id: uid(),
      role: "action",
      title: `${created ? `Criei o grupo ${group.name} e adicionei` : "Adicionei"} ${rows.length === 1 ? "1 item" : `${rows.length} itens`}${created ? "" : ` em ${group.name}`}`,
      lines: cmd.items.map((it) => `${it.name} · ${money(it.value)} planejado · ${guessType(it.name, it.type) === "fixo" ? "fixo" : "variável"}`),
      undo: async () => {
        await Promise.all(rows.map((r) => api(`/api/plan-items/${r.id}`, "DELETE")));
        if (created) { await api(`/api/plan-groups/${group.id}`, "DELETE"); await reloadGroups(); }
        await reloadItems();
      },
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
      const over = found.planned > 0 && next > found.planned;
      push({
        id: uid(),
        role: "action",
        title: cmd.value === null ? `${found.name} marcado como pago` : `${found.name}: + ${money(cmd.value)}`,
        lines: [
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
    push({
      id: uid(),
      role: "action",
      title: `Lancei ${money(cmd.value)} em ${cmd.name}`,
      lines: [`Item novo em ${group.name}, sem valor planejado`],
      undo: async () => {
        await api(`/api/plan-items/${row.id}`, "DELETE");
        if (created) { await api(`/api/plan-groups/${group.id}`, "DELETE"); await reloadGroups(); }
        await reloadItems();
      },
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
    push({
      id: uid(),
      role: "action",
      title: `Renda: + ${money(cmd.value)} de ${cmd.description}`,
      lines: [`Renda de ${monthLabel}: ${money(total)}`],
      undo: added ? async () => {
        const { incomes: after } = await api<{ incomes: PlanIncome[] }>(`/api/plan-income/${added.id}`, "DELETE");
        onIncomes(after);
      } : undefined,
    });
  }

  async function askAi(text: string) {
    if (!botEnabled) {
      showAnswer({ ...answer({ kind: "help" }, snapshot)!, title: "Essa eu não sei calcular ainda. Tente assim:" });
      return;
    }
    const res = await fetch("/api/bot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: `[Pergunta feita no MUVO Gênio, a calculadora do Planejamento mensal] ${text}` }],
        page: readBotPageContext(),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showAnswer({ ...answer({ kind: "help" }, snapshot)!, title: "Não entendi esse pedido. Tente assim:" });
      return;
    }
    push({ id: uid(), role: "ai", text: String(data?.reply ?? "") });
  }

  async function run(cmd: GenieCommand, text: string) {
    switch (cmd.kind) {
      case "addItems": return addItems(cmd);
      case "spend": return spend(cmd);
      case "createGroups": return createGroups(cmd.names);
      case "addIncome": return addIncome(cmd);
      case "unknown": return askAi(text);
      default: {
        const a = answer(cmd, snapshot);
        if (a) showAnswer(a);
      }
    }
  }

  async function send(raw?: string) {
    const text = withLast(raw ?? input);
    if (!text || busy) return;
    setInput("");
    push({ id: uid(), role: "user", text });
    setBusy(true);
    try {
      await run(parseGenie(text, groupNames, FALLBACK_CDI), text);
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

  async function undo(msg: Extract<Msg, { role: "action" }>) {
    if (!msg.undo || msg.undone || busy) return;
    setBusy(true);
    try {
      await msg.undo();
      patch(msg.id, { undone: true });
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

  const display = preview !== null
    ? { label: withLast(input), value: plain(preview), live: true }
    : last ? { label: last.label, value: last.value, live: false } : null;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar MUVO Gênio" : "Abrir MUVO Gênio, a calculadora do planejamento"}
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
          : <Image src="/bot/muvo-genio.webp" alt="" width={56} height={56} className="h-full w-full object-cover" priority />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="MUVO Gênio"
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
                <Image src="/bot/muvo-genio.webp" alt="" width={40} height={40} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-black leading-tight tracking-tight">MUVO Gênio</p>
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
            <div ref={tapeRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5" aria-live="polite">
              {msgs.length === 0 ? (
                <div className="flex flex-col items-center pt-2 text-center">
                  <Image src="/bot/muvo-genio-full.webp" alt="Mascote do MUVO Gênio: um rato de óculos escuros e jaqueta" width={720} height={756} className="h-36 w-auto select-none" />
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
                    <MessageView msg={m} groups={groups} busy={busy} onPick={pickGroup} onUndo={undo} />
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
            <div className="mx-3 mb-2 rounded-2xl bg-foreground px-4 py-3 text-background">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[11px] text-background/60">
                  {display ? display.label : "Visor"}
                </p>
                {display && !display.live && (
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard?.writeText(display.value); toast.success("Copiado"); }}
                    aria-label="Copiar resultado"
                    className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-background/60 hover:text-background"
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
                placeholder={last ? "Continue a conta: + 10%, × 12…" : "Conta ou pedido…"}
                aria-label="Conta ou pedido para o MUVO Gênio"
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
  msg, groups, busy, onPick, onUndo,
}: {
  msg: Msg;
  groups: ExpenseGroup[];
  busy: boolean;
  onPick: (m: Extract<Msg, { role: "pick" }>, group: string) => void;
  onUndo: (m: Extract<Msg, { role: "action" }>) => void;
}) {
  switch (msg.role) {
    case "user":
      return (
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3 py-2 text-sm">{msg.text}</p>
        </div>
      );

    case "answer": {
      const a = msg.answer;
      const toneText = a.tone === "good" ? "text-green-600 dark:text-green-400" : a.tone === "bad" ? "text-destructive" : "";
      return (
        <div className="rounded-2xl border px-3.5 py-3">
          <p className="text-xs text-muted-foreground">{a.title}</p>
          {a.value && <p className={cn("mt-0.5 font-display text-2xl font-black tabular-nums tracking-tight", toneText)}>{a.value}</p>}
          {a.lines && a.lines.length > 0 && (
            <dl className="mt-2 space-y-1 border-t pt-2">
              {a.lines.map((l, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 text-xs">
                  <dt className="min-w-0 text-muted-foreground">{l.label}</dt>
                  <dd className={cn(
                    "shrink-0 text-right font-semibold tabular-nums",
                    l.tone === "good" && "text-green-600 dark:text-green-400",
                    l.tone === "bad" && "text-destructive",
                  )}>{l.value}</dd>
                </div>
              ))}
            </dl>
          )}
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
              {msg.lines.map((l, i) => <p key={i} className="mt-0.5 text-xs text-muted-foreground">{l}</p>)}
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={msg.done || busy}
                onClick={() => onPick(msg, g.name)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                {g.name}
              </button>
            ))}
          </div>
        </div>
      );

    case "ai":
      return (
        <div className="flex gap-2">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border bg-white">
            <Image src="/bot/muvo-genio.webp" alt="" width={28} height={28} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 rounded-2xl rounded-tl-md border px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
            {msg.text.split(/\n+/).filter(Boolean).map((line, i) => (
              <p key={i}><Bold text={line.replace(/^[-•]\s+/, "• ")} /></p>
            ))}
          </div>
        </div>
      );

    case "error":
      return <p className="rounded-2xl border border-destructive/30 px-3.5 py-2.5 text-xs text-destructive">{msg.text}</p>;
  }
}
