import type { NavItem } from "@/lib/nav";

/** Fica em components/ porque o Tailwind só gera classes encontradas em pages/, components/ e app/. */
export const FEATURED_DOT: Record<NonNullable<NavItem["featured"]>, string> = {
  amber: "bg-amber-400",
  cyan: "bg-cyan-400",
};
