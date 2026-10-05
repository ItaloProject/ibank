/** Máscara de real que preenche da direita para a esquerda: digitar 405807 mostra 4.058,07. */
export function maskMoney(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseMoneyMask(masked: string): number {
  const digits = masked.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

export function toMoneyMask(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "";
  return maskMoney(String(Math.round(value * 100)));
}

const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Põe pontos de milhar nos números de um texto livre (o Gênio aceita "gastei 4058,07 em mercado" e "200 + 50").
 * Não mexe em número colado em letra (PETR4) nem em ponto que pareça decimal ("10.5"), para não mudar o valor.
 */
export function groupNumbers(text: string): string {
  return text.replace(/(?<![\p{L}\d.,])(\d[\d.]*)(,\d*)?(?![\p{L}\d])/gu, (match, int: string, dec = "") => {
    if (int.endsWith(".")) return match;
    if (int.includes(".") && !/^\d{1,3}(\.\d{3,})+$/.test(int)) return match;
    const digits = int.replace(/\./g, "");
    return digits.length < 4 ? match : group(digits) + dec;
  });
}

/** Só agrupa quando o texto é uma conta; frases ficam como digitadas para não virar "em 2.030". */
export function groupCalcNumbers(text: string): string {
  return /^[\d\s.,+\-−*/×÷%()^=]*$/.test(text) ? groupNumbers(text) : text;
}

/** Posição do cursor depois de reformatar: conta os caracteres que não são ponto antes do cursor. */
export function caretAfterGrouping(before: string, caret: number, after: string): number {
  let keep = before.slice(0, caret).replace(/\./g, "").length;
  let i = 0;
  while (i < after.length && keep > 0) {
    if (after[i] !== ".") keep--;
    i++;
  }
  return i;
}
