/**
 * Chamada de modelo de linguagem, usando o provedor configurado:
 * ANTHROPIC_API_KEY (Claude) ou OPENAI_API_KEY (GPT). Modelo ajustável por env.
 */
export type ChatMessage = { role: "user" | "assistant"; content: string };

export function llmProvider(): "anthropic" | "openai" | null {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

export async function completeChat(system: string, messages: ChatMessage[], maxTokens = 900): Promise<string> {
  const provider = llmProvider();
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5",
        max_tokens: maxTokens,
        system,
        messages,
      }),
      cache: "no-store",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message ?? `Anthropic ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
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
