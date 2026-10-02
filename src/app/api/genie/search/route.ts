import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { consumeDailyQuota } from "@/lib/bot-schema";
import { buildSearchQuery } from "@/lib/genie/chat";

export const dynamic = "force-dynamic";

type Result = { answer: string; sources: { title: string; url: string }[] };

/** A cota gratuita do Tavily é de 1.000 buscas por mês: 30 por dia no total cabem nela com folga. */
const PER_USER = 10;
const TOTAL = 30;
const DAY = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: Result }>();

/**
 * Visão geral criada por inteligência artificial para perguntas gerais que o Muvo Gênio não responde sozinho.
 * Só o texto da pergunta sai do Muvo: nenhum valor do planejamento vai para a busca.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Pesquisa na web desligada." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { text?: unknown; context?: unknown } | null;
  const query = buildSearchQuery(typeof body?.text === "string" ? body.text : "", typeof body?.context === "string" ? body.context : null);
  if (!query) return NextResponse.json({ error: "Pergunta vazia." }, { status: 400 });

  const cacheKey = query.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < DAY) return NextResponse.json(hit.data);

  if (!(await consumeDailyQuota(auth.userId, "search", PER_USER, TOTAL))) {
    return NextResponse.json({ error: "A pesquisa na web chegou ao limite de hoje." }, { status: 429 });
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
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
    const answer = typeof data.answer === "string" ? data.answer.trim() : "";
    if (!answer) return NextResponse.json({ error: "Não encontrei uma resposta clara." }, { status: 404 });
    const sources = (data.results ?? [])
      .filter((r) => typeof r.url === "string" && /^https?:\/\//.test(r.url))
      .slice(0, 3)
      .map((r) => ({ title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 120) : new URL(r.url as string).hostname, url: r.url as string }));
    const result: Result = { answer: answer.slice(0, 1500), sources };
    if (cache.size >= 300) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { at: Date.now(), data: result });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "A pesquisa na web não respondeu." }, { status: 502 });
  }
}
