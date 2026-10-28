import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Todo arquivo .ts dentro da pasta, em qualquer subpasta */
function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return caminho.endsWith(".ts") ? [caminho] : [];
  });
}

describe("respostas da API do cardápio", () => {
  // Sem o cabeçalho de CORS, o navegador esconde a resposta e o painel mostra só "Failed to fetch".
  // Por isso toda resposta das rotas passa por json() (src/lib/cardapio-acesso.ts), que já inclui o cabeçalho.
  it("nenhuma rota responde com NextResponse.json direto", () => {
    const diretas = arquivos("src/app/api/cardapio").filter((f) => readFileSync(f, "utf8").includes("NextResponse.json("));
    expect(diretas).toEqual([]);
  });
});
