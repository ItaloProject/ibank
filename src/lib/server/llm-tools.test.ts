import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeChatWithTools } from "@/lib/server/llm";

const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("laço de ferramentas do assistente", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.unstubAllGlobals();
  });

  it("executa a ferramenta pedida pelo modelo e devolve a resposta final", async () => {
    const calls: unknown[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        reply({
          stop_reason: "tool_use",
          content: [{ type: "tool_use", id: "tu_1", name: "calcular_aplicacao_dias", input: { valor: 4000, dias: 4 } }],
        }),
      )
      .mockResolvedValueOnce(reply({ stop_reason: "end_turn", content: [{ type: "text", text: "Você fica com R$ 4.000,66." }] }));
    vi.stubGlobal("fetch", fetchMock);

    const text = await completeChatWithTools(
      "sistema",
      [{ role: "user", content: "quanto fico com 4000 em 4 dias?" }],
      [],
      async (name, input) => {
        calls.push({ name, input });
        return '{"valor_final":"R$ 4.000,66"}';
      },
    );

    expect(text).toBe("Você fica com R$ 4.000,66.");
    expect(calls).toEqual([{ name: "calcular_aplicacao_dias", input: { valor: 4000, dias: 4 } }]);

    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolResult = second.messages.at(-1).content[0];
    expect(toolResult).toMatchObject({ type: "tool_result", tool_use_id: "tu_1", content: '{"valor_final":"R$ 4.000,66"}' });
  });

  it("uma ferramenta que falha vira erro para o modelo, sem derrubar a conversa", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          reply({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_2", name: "x", input: {} }] }),
        )
        .mockResolvedValueOnce(reply({ stop_reason: "end_turn", content: [{ type: "text", text: "Preciso de mais dados." }] })),
    );

    const text = await completeChatWithTools("s", [{ role: "user", content: "oi" }], [], async () => {
      throw new Error("falha interna");
    });
    expect(text).toBe("Preciso de mais dados.");
  });

  it("para depois do limite de passos mesmo se o modelo insistir em ferramentas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu", name: "consultar_cdi", input: {} }] }),
      ),
    );
    const text = await completeChatWithTools("s", [{ role: "user", content: "oi" }], [], async () => "{}", { maxSteps: 2 });
    expect(text).toMatch(/Não consegui concluir/);
  });
});
