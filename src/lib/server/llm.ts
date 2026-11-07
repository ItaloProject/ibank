/**
 * Chamada de modelo de linguagem, usando o provedor configurado:
 * ANTHROPIC_API_KEY (Claude) ou OPENAI_API_KEY (GPT). Modelo ajustável por env.
 */
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textOf(content: any): string {
  if (typeof content === "string") return content.trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (Array.isArray(content)) return content.filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n").trim();
  return "";
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
      body: JSON.stringify({ model: anthropicModel(), max_tokens: maxTokens, system, messages }),
      cache: "no-store",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message ?? `Anthropic ${res.status}`);
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
 * Conversa com ferramentas em LangGraph: um nó chama o Claude, outro executa as ferramentas do app,
 * e a aresta repete até a resposta final. Sem Claude, cai no texto puro.
 */
export async function completeChatWithTools(
  system: string,
  messages: ChatMessage[],
  tools: ToolDef[],
  run: (name: string, input: unknown) => Promise<string>,
  { maxSteps = 4, maxTokens = 900 }: { maxSteps?: number; maxTokens?: number } = {},
): Promise<string> {
  if (llmProvider() !== "anthropic") return completeChat(system, messages, maxTokens);

  const model = new ChatAnthropic({
    model: anthropicModel(),
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
    maxTokens,
  }).bindTools(tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })));

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => ({ messages: [await model.invoke([new SystemMessage(system), ...state.messages])] }))
    .addNode("tools", async (state) => {
      const last = state.messages.at(-1) as AIMessage;
      const results = await Promise.all(
        (last.tool_calls ?? []).map(async (call) =>
          new ToolMessage({
            tool_call_id: call.id ?? call.name,
            name: call.name,
            content: await run(call.name, call.args).catch((err: unknown) => `Erro: ${err instanceof Error ? err.message : "falha no cálculo"}`),
          }),
        ),
      );
      return { messages: results };
    })
    .addEdge(START, "agent")
    .addConditionalEdges("agent", (state) => ((state.messages.at(-1) as AIMessage).tool_calls?.length ? "tools" : END))
    .addEdge("tools", "agent")
    .compile();

  try {
    const result = await graph.invoke(
      { messages: messages.map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content))) },
      { recursionLimit: 2 * maxSteps + 1 },
    );
    return textOf((result.messages.at(-1) as AIMessage).content) || "Não consegui formular uma resposta. Pode reformular a pergunta?";
  } catch (err) {
    if (err instanceof Error && err.name === "GraphRecursionError") {
      return "Não consegui concluir o cálculo. Tente reformular a pergunta.";
    }
    throw err;
  }
}
