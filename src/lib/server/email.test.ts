import { afterEach, describe, expect, it, vi } from "vitest";

const send = vi.fn(async () => ({ data: { id: "msg_1" }, error: null }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

describe("enviarEmail", () => {
  afterEach(() => {
    send.mockClear();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.resetModules();
  });

  it("não envia sem RESEND_API_KEY", async () => {
    const { enviarEmail, emailConfigurado } = await import("./email");
    expect(emailConfigurado()).toBe(false);
    expect(await enviarEmail({ para: "a@b.com", assunto: "x", texto: "y" })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("envia pelo Resend quando a chave existe", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "MUVO <seguranca@muvo.dev.br>";
    const { enviarEmail, emailConfigurado } = await import("./email");
    expect(emailConfigurado()).toBe(true);
    expect(await enviarEmail({ para: "pessoa@exemplo.com", assunto: "Alerta", texto: "bloqueio", idempotencyKey: "bloqueio/x" })).toBe(true);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "MUVO <seguranca@muvo.dev.br>",
        to: ["pessoa@exemplo.com"],
        subject: "Alerta",
        idempotencyKey: "bloqueio/x",
      }),
    );
  });
});
