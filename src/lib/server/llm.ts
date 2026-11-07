/**
 * Chamada de modelo de linguagem, usando o provedor configurado:
 * ANTHROPIC_API_KEY (Claude) ou OPENAI_API_KEY (GPT). Modelo ajustável por env.
 */
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };

export function llmProvider(): "anthropic" | "openai" | null {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-5-5";
}

async function anthropicCall(body: Record<string, unknown>) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: anthropicModel(), ...body }),
    cache: "no-store",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Anthropic ${res.status}`);
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textOf(content: any[]): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
}

export async function completeChat(system: string, messages: ChatMessage[], maxTokens = 900): Promise<string> {
  const provider = llmProvider();
  if (provider === "anthropic") {
    const data = await anthropicCall({ max_tokens: maxTokens, system, messages });
    return textOf(data?.content);
  }
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
      cache: "no-store",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message ?? `OpenAI ${res.status}`);
    return String(data?.choices?.[0]?.message?.content ?? "").trim();
  }
  throw new Error("Nenhum provedor de IA configurado");
}

/**
 * Conversa com ferramentas (Claude): o modelo pede um cálculo, o servidor executa com as funções do
 * próprio app e devolve o resultado, até a resposta final. Sem Claude, cai no texto puro.
 */
export async function completeChatWithTools(
  system: string,
  messages: ChatMessage[],
  tools: ToolDef[],
  run: (name: string, input: unknown) => Promise<string>,
  { maxSteps = 4, maxTokens = 900 }: { maxSteps?: number; maxTokens?: number } = {},
): Promise<string> {
  if (llmProvider() !== "anthropic") return completeChat(system, messages, maxTokens);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convo: { role: "user" | "assistant"; content: any }[] = messages.map((m) => ({ role: m.role, content: m.content }));
  let last: string[] = [];
  for (let step = 0; step < maxSteps; step++) {
    const data = await anthropicCall({ max_tokens: maxTokens, system, messages: convo, tools });
    const content = data?.content ?? [];
    if (data?.stop_reason !== "tool_use") return textOf(content);
    convo.push({ role: "assistant", content });
    const results = [];
    for (const block of content) {
      if (block.type !== "tool_use") continue;
      const out = await run(block.name, block.input).catch((err: unknown) => `Erro: ${err instanceof Error ? err.message : "falha no cálculo"}`);
      results.push({ type: "tool_result", tool_use_id: block.id, content: out });
    }
    convo.push({ role: "user", content: results });
    last = [textOf(content)];
  }
  return last[0] || "Não consegui concluir o cálculo. Tente reformular a pergunta.";
}
