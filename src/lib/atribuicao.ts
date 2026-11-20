/**
 * Origem do cadastro (UTM dos anúncios). Só etiquetas de campanha: nada que identifique a pessoa.
 * O navegador guarda num cookie próprio (30 dias) quando a pessoa chega por um link com utm_*, e o servidor
 * lê esse cookie quando a conta é criada. Sem pixel e sem serviço de terceiros.
 */

export const COOKIE_ATRIBUICAO = "muvo_atrib";
export const VALIDADE_ATRIBUICAO_SEGUNDOS = 30 * 24 * 60 * 60;
export const CAMPOS_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export type CampoUtm = (typeof CAMPOS_UTM)[number];
export type Atribuicao = Partial<Record<CampoUtm, string>>;

/** Só letras, números, ponto, hífen e sublinhado; minúsculas; até 60 caracteres. Vazio vira indefinido. */
export function limparUtm(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpo = valor.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 60);
  return limpo || undefined;
}

function montar(leitor: (campo: CampoUtm) => unknown): Atribuicao | null {
  const out: Atribuicao = {};
  for (const campo of CAMPOS_UTM) {
    const valor = limparUtm(leitor(campo));
    if (valor) out[campo] = valor;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Lê os utm_* de uma query string (`?utm_source=instagram&...`). Sem nenhum utm_*, devolve null. */
export function atribuicaoDaBusca(search: string): Atribuicao | null {
  const params = new URLSearchParams(search);
  return montar((campo) => params.get(campo));
}

/** Lê o cookie `muvo_atrib` do cabeçalho Cookie. Conteúdo inválido ou adulterado é ignorado. */
export function atribuicaoDoCookie(cabecalho: string | null | undefined): Atribuicao | null {
  if (!cabecalho) return null;
  const par = cabecalho
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_ATRIBUICAO}=`));
  if (!par) return null;
  try {
    const bruto = JSON.parse(decodeURIComponent(par.slice(COOKIE_ATRIBUICAO.length + 1)));
    if (!bruto || typeof bruto !== "object") return null;
    return montar((campo) => (bruto as Record<string, unknown>)[campo]);
  } catch {
    return null;
  }
}

/** Texto do cookie a gravar no navegador. */
export function cookieDeAtribuicao(atrib: Atribuicao, https: boolean): string {
  const valor = encodeURIComponent(JSON.stringify(atrib));
  return `${COOKIE_ATRIBUICAO}=${valor}; Max-Age=${VALIDADE_ATRIBUICAO_SEGUNDOS}; Path=/; SameSite=Lax${https ? "; Secure" : ""}`;
}
