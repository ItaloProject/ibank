import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isWindowOpen, maskPhone, templateParam, verifySignature, waLink } from "@/lib/whatsapp";

describe("whatsapp", () => {
  it("valida a assinatura do webhook", () => {
    const body = '{"entry":[]}';
    const sig = `sha256=${createHmac("sha256", "segredo").update(body).digest("hex")}`;
    expect(verifySignature(body, sig, "segredo")).toBe(true);
    expect(verifySignature(body, sig, "outro")).toBe(false);
    expect(verifySignature(body + " ", sig, "segredo")).toBe(false);
    expect(verifySignature(body, null, "segredo")).toBe(false);
  });

  it("janela de 24 horas com margem de segurança", () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    expect(isWindowOpen("2026-09-25T00:00:00Z", now)).toBe(true);
    expect(isWindowOpen("2026-09-24T12:30:00Z", now)).toBe(true);
    expect(isWindowOpen("2026-09-24T12:03:00Z", now)).toBe(false);
    expect(isWindowOpen(null, now)).toBe(false);
  });

  it("formata parâmetros de modelo, links e telefone", () => {
    expect(templateParam("linha 1\nlinha 2\t     fim").text).toBe("linha 1 linha 2 fim".replace("2 fim", "2   fim"));
    expect(waLink("5511999999999", "MUVO-ABC123 oi")).toBe("https://wa.me/5511999999999?text=MUVO-ABC123%20oi");
    expect(maskPhone("5511987654321")).toBe("+55 (11) •••••-4321");
  });
});
