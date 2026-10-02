/** Distância de edição entre duas palavras (inserir, apagar, trocar ou inverter letras vizinhas). */
export function distance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return m || n;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** Quantos erros aceitar para uma palavra deste tamanho. */
const tolerance = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

/** Parecido o bastante para ser erro de digitação (textos já normalizados). */
export function similar(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a || !b || a[0] !== b[0]) return false;
  return distance(a, b) <= tolerance(Math.min(a.length, b.length));
}

const COMMANDS = [
  "adicionar", "adiciona", "adicione", "colocar", "coloca", "coloque", "incluir", "inclui", "inclua", "lancar", "lanca", "lance",
  "criar", "cria", "crie", "grupo", "grupos", "categoria", "categorias", "novo", "nova", "item", "itens",
  "gastei", "gastamos", "paguei", "comprei", "recebi", "ganhei", "entrou", "salario", "renda", "receita",
  "apagar", "apaga", "apague", "excluir", "exclui", "exclua", "remover", "remove", "deletar", "deleta",
  "mudar", "muda", "mude", "alterar", "altera", "atualizar", "atualiza", "ajustar", "ajusta", "trocar", "troca",
  "quanto", "quantos", "sobra", "sobrou", "posso", "gastar", "gastei", "cortar", "reduzir", "economizar", "juntar", "guardar",
  "parcela", "parcelar", "financiamento", "emprestimo", "investindo", "aplicando", "resumo", "ajuda",
];
const COMMAND_SET = new Set(COMMANDS);

/** Palavras comuns que lembram comandos mas não devem ser trocadas. */
const KEEP = new Set(["sobre", "venda", "vendas", "passo", "crise", "nove", "novos", "novas", "gasto", "gastos", "quanta", "posse"]);

/**
 * Corrige erros de digitação nos comandos, só nas três primeiras palavras,
 * onde ficam os verbos e "grupo", para não alterar nomes de itens.
 */
export function fixTypos(t: string): string {
  const words = t.split(" ");
  for (let i = 0; i < Math.min(3, words.length); i++) {
    const w = words[i];
    if (w.length < 4 || /\d/.test(w) || COMMAND_SET.has(w) || KEEP.has(w)) continue;
    const best = COMMANDS
      .filter((c) => similar(w, c))
      .sort((a, b) => distance(w, a) - distance(w, b))[0];
    if (best) words[i] = best;
  }
  return words.join(" ");
}
