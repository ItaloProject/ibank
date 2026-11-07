import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []);
vi.mock("@/lib/db", () => ({ default: (...args: unknown[]) => sqlMock(...args) }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => NextResponse.json({ error: "Não autenticado" }, { status: 401 })),
}));

import { GET } from "@/app/api/auth/setup/route";

const pedido = (headers: Record<string, string> = {}) => new Request("http://x/api/auth/setup", { headers });

describe("rota de setup", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockImplementation(async () => []);
    process.env.SETUP_SECRET = "segredo-de-teste";
    delete process.env.DEFAULT_PASSWORD;
  });
  afterEach(() => {
    delete process.env.SETUP_SECRET;
  });

  it("sem login nem segredo, não altera o banco", async () => {
    const res = await GET(pedido());
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("com segredo errado, também não altera nada", async () => {
    const res = await GET(pedido({ authorization: "Bearer errado" }));
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("com o segredo certo e banco já com usuários, atualiza o schema", async () => {
    sqlMock.mockImplementation(async (strings: unknown) => {
      const texto = Array.isArray(strings) ? (strings as string[]).join("") : "";
      return /SELECT id FROM app_users/.test(texto) ? [{ id: 1 }] : [];
    });
    const res = await GET(pedido({ authorization: "Bearer segredo-de-teste" }));
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalled();
  });

  it("não cria usuários sem DEFAULT_PASSWORD (sem senha no código)", async () => {
    sqlMock.mockImplementation(async (strings: unknown) => {
      const texto = Array.isArray(strings) ? (strings as string[]).join("") : "";
      return /SELECT id FROM app_users/.test(texto) ? [] : [];
    });
    const res = await GET(pedido({ authorization: "Bearer segredo-de-teste" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/DEFAULT_PASSWORD/);
  });
});
