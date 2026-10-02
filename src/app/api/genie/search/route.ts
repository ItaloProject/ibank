import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { consumeDailyQuota } from "@/lib/bot-schema";
import { buildSearchQuery } from "@/lib/genie/chat";
import { canLearn } from "@/lib/genie/knowledge";
import { learnAnswer, recall, type Source } from "@/lib/server/genie-knowledge";

export const dynamic = "force-dynamic";

type Result = { answer: string; sources: Source[]; id: number | null; learned: boolean };

/** A cota gratuita do Tavily é de 1.000 buscas por mês: 30 por dia no total cabem nela com folga. */
const PER_USER = 10;
const TOTAL = 30;
const DAY = 24 * 60 * 60 * 1000;
/** Perguntas que não vão para a memória (com números, por exemplo) ficam aqui por um dia. */
const cache = new Map<string, { at: number; data: Result }>();

/**
 * Resposta para perguntas gerais que o Muvo Gênio não sabe sozinho.
 * Primeiro procura no que já aprendeu; se não souber, pesquisa a Visão geral na web e aprende a resposta.
 * Só o texto da pergunta sai do Muvo: nenhum valor do planejamento vai para a busca.
 * `fresh` ignora a memória, para quando a resposta aprendida não ajudou.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as { text?: unknown; context?: unknown; fresh?: unknown; memoryOnly?: unknown } | null;
  const query = buildSearchQuery(typeof body?.text === "string" ? body.text : "", typeof body?.context === "string" ? body.context : null);
  if (!query) return NextResponse.json({ error: "Pergunta vazia." }, { status: 400 });
  const fresh = body?.fresh === true;

  if (!fresh) {
    const known = await recall(query).catch(() => null);
    if (known) return NextResponse.json({ answer: known.answer, sources: known.sources, id: known.id, learned: true } satisfies Result);
  }
  // O assistente de investimentos só consulta o que já foi aprendido; o resto vai para a inteligência artificial dele.
  if (body?.memoryOnly === true) return NextResponse.json({ error: "Ainda não aprendi." }, { status: 404 });

  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Pesquisa na web desligada." }, { status: 503 });

  const cacheKey = query.toLowerCase();
  const hit = cache.get(cacheKey);
  if (!fresh && hit && Date.now() - hit.at < DAY) return NextResponse.json(hit.data);

  if (!(await consumeDailyQuota(auth.userId, "search", PER_USER, TOTAL))) {
    return NextResponse.json({ error: "A pesquisa na web chegou ao limite de hoje." }, { status: 429 });
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Sem o pedido explícito, a Visão geral do Tavily vem em inglês mesmo com a pergunta em português.
        query: `${query.replace(/[.?!\s]+$/, "")}? Responda em português do Brasil.`,
        search_depth: "basic",
        topic: "general",
        country: "brazil",
        include_answer: "basic",
        max_results: 3,
        safe_search: true,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return NextResponse.json({ error: "A pesquisa na web não respondeu." }, { status: 502 });
    const data = (await res.json()) as { answer?: unknown; results?: { title?: unknown; url?: unknown }[] };
    const answer = typeof data.answer === "string" ? data.answer.trim().slice(0, 1500) : "";
    if (!answer) return NextResponse.json({ error: "Não encontrei uma resposta clara." }, { status: 404 });
    const sources = (data.results ?? [])
      .filter((r) => typeof r.url === "string" && /^https?:\/\//.test(r.url))
      .slice(0, 3)
      .map((r) => ({ title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 120) : new URL(r.url as string).hostname, url: r.url as string }));

    const id = canLearn(query) ? await learnAnswer(query, answer, sources).catch(() => null) : null;
    const result: Result = { answer, sources, id, learned: false };
    if (id === null) {
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { at: Date.now(), data: result });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "A pesquisa na web não respondeu." }, { status: 502 });
  }
}
