import { createHash, timingSafeEqual } from "node:crypto";

/** Compara segredos sem vazar o tamanho nem o ponto da diferença. */
export function secretMatches(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!received || !expected) return false;
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(received), digest(expected));
}
