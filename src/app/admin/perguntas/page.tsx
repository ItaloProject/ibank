"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion, Globe, ThumbsDown, Sparkles, Bot, Users } from "lucide-react";
import { useUser } from "@/context/user-context";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

interface Grouped {
  pergunta: string;
  vezes: number;
  pessoas: number;
  tipos: string[];
  internet: boolean;
  ultima: string;
}

interface Report {
  ultimos30Dias: Record<string, number>;
  porPergunta: Grouped[];
}

const KIND_LABEL: Record<string, { label: string; icon: typeof Bot; className: string }> = {
  genio: { label: "Gênio", icon: Sparkles, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  sem_resposta: { label: "Assistente", icon: Bot, className: "bg-violet-500/10 text-violet-500 dark:text-violet-300" },
  down: { label: "Resposta ruim", icon: ThumbsDown, className: "bg-destructive/10 text-destructive" },
};

const FILTERS = [
  { id: "todas", label: "Todas" },
  { id: "genio", label: "Gênio" },
  { id: "sem_resposta", label: "Assistente" },
  { id: "down", label: "Respostas ruins" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

export default function PerguntasPage() {
  const { isAdmin } = useUser();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("todas");

  useEffect(() => {
    if (!isAdmin) { router.replace("/"); return; }
    fetch("/api/bot/feedback")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setReport)
      .catch(() => setFailed(true));
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(
    () => (report?.porPergunta ?? []).filter((r) => filter === "todas" || r.tipos.includes(filter)),
    [report, filter],
  );

  if (!isAdmin) return null;

  const counts = report?.ultimos30Dias ?? {};
  const stats = [
    { label: "Gênio não entendeu", value: counts.genio ?? 0 },
    { label: "Assistente sem resposta", value: counts.sem_resposta ?? 0 },
    { label: "Respostas marcadas como ruins", value: counts.down ?? 0 },
  ];

  return (
    <PageShell>
      <PageHeader
        width="cozy"
        title="Perguntas sem resposta"
        description="O que os robôs não souberam responder nos últimos 30 dias, das mais repetidas para as menos"
      />

      <PageBody width="cozy">
        <div className="grid grid-cols-3 gap-3">
          {stats.map(({ label, value }) => (
            <div key={label} className="rounded-2xl border bg-card px-4 py-3.5">
              <p className="text-xl font-bold leading-none tabular-nums">{report ? value : "—"}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border bg-card overflow-hidden">
          {failed ? (
            <p className="py-14 text-center text-sm text-muted-foreground">Não foi possível carregar o relatório.</p>
          ) : !report ? (
            <div className="divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-4 py-4 space-y-2 animate-pulse">
                  <div className="h-3.5 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <MessageCircleQuestion className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhuma pergunta sem resposta neste período.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.pergunta} className="px-4 py-3.5 flex items-start gap-3">
                  <span className="mt-0.5 min-w-8 rounded-lg bg-muted px-2 py-1 text-center text-xs font-bold tabular-nums">
                    {r.vezes}×
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium break-words">{r.pergunta}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {r.tipos.map((t) => {
                        const k = KIND_LABEL[t];
                        if (!k) return null;
                        const Icon = k.icon;
                        return (
                          <span key={t} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${k.className}`}>
                            <Icon className="h-3 w-3" /> {k.label}
                          </span>
                        );
                      })}
                      {r.internet && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                          <Globe className="h-3 w-3" /> Respondida pela internet
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" /> {r.pessoas} {r.pessoas === 1 ? "pessoa" : "pessoas"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        · última em {new Date(r.ultima).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageBody>
    </PageShell>
  );
}
