import { cn } from "@/lib/utils";
import { LABEL, MONEY } from "@/components/investimentos/live-ui";

/** Linha de ficha (ação ou FII): rótulo à esquerda, valor à direita. */
export function AssetFact({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "gain" | "loss" | "muted";
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className={`${LABEL} block`}>{label}</span>
        {hint && <span className="mt-1 block text-[11px] text-muted-foreground leading-snug">{hint}</span>}
      </span>
      <span
        className={cn(
          `${MONEY} text-sm text-right leading-snug shrink-0`,
          tone === "gain" && "text-emerald-600 dark:text-emerald-400",
          tone === "loss" && "text-red-600 dark:text-red-400",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
