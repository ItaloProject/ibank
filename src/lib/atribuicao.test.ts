import { describe, expect, it } from "vitest";
import {
  atribuicaoDaBusca,
  atribuicaoDoCookie,
  cookieDeAtribuicao,
  COOKIE_ATRIBUICAO,
  limparUtm,
} from "./atribuicao";

describe("atribuição (utm)", () => {
  it("lê os utm da URL e padroniza em minúsculas", () => {
    expect(
      atribuicaoDaBusca("?utm_source=Instagram&utm_medium=paid&utm_campaign=MUVO_TRAF_BROAD_13o_Dez26&utm_content=A5"),
    ).toEqual({
      utm_source: "instagram",
      utm_medium: "paid",
      utm_campaign: "muvo_traf_broad_13o_dez26",
      utm_content: "a5",
    });
  });

  it("sem utm na URL devolve null e ignora outros parâmetros", () => {
    expect(atribuicaoDaBusca("")).toBeNull();
    expect(atribuicaoDaBusca("?fbclid=abc&foo=bar")).toBeNull();
  });

  it("remove caracteres estranhos e limita o tamanho", () => {
    expect(limparUtm("a b<script>c</script>")).toBe("abscriptcscript");
    expect(limparUtm("x".repeat(200))?.length).toBe(60);
    expect(limparUtm("   ")).toBeUndefined();
    expect(limparUtm(123)).toBeUndefined();
  });

  it("cookie gravado e lido de volta dá a mesma origem", () => {
    const atrib = { utm_source: "instagram", utm_medium: "paid", utm_campaign: "13o", utm_content: "a5" };
    const texto = cookieDeAtribuicao(atrib, true);
    expect(texto).toContain("Max-Age=2592000");
    expect(texto).toContain("SameSite=Lax");
    expect(texto).toContain("Secure");
    expect(cookieDeAtribuicao(atrib, false)).not.toContain("Secure");
    const valor = texto.split(";")[0];
    expect(atribuicaoDoCookie(`outro=1; ${valor}; mais=2`)).toEqual(atrib);
  });

  it("cookie ausente, quebrado ou adulterado não dá erro", () => {
    expect(atribuicaoDoCookie(null)).toBeNull();
    expect(atribuicaoDoCookie("outro=1")).toBeNull();
    expect(atribuicaoDoCookie(`${COOKIE_ATRIBUICAO}=%E0%A4%A`)).toBeNull();
    expect(atribuicaoDoCookie(`${COOKIE_ATRIBUICAO}=${encodeURIComponent('"texto"')}`)).toBeNull();
    expect(
      atribuicaoDoCookie(`${COOKIE_ATRIBUICAO}=${encodeURIComponent(JSON.stringify({ utm_source: "<b>x</b>", extra: "y" }))}`),
    ).toEqual({ utm_source: "bxb" });
  });
});
