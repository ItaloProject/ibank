"use client";

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import "./live-icons-3d.css";

/** Mantido só para tipos antigos; o menu passa o ícone Lucide direto. */
export type Icon3DKind = "overview" | "wallet" | "calculator" | "rebalance";

/**
 * Tile do menu do Live: ícone Lucide (mesmo traço do restante do app),
 * label sempre visível e feedback de hover/clique.
 */
export function Icon3D({
  icon: Icon,
  label,
  index,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  index: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="l3d"
      aria-label={label}
      onClick={onSelect}
      style={{ "--i": index } as CSSProperties}
    >
      <span className="l3d-float" aria-hidden="true">
        <span className="l3d-scene">
          <span className="l3d-glyph">
            <Icon strokeWidth={1.75} absoluteStrokeWidth={false} aria-hidden="true" />
          </span>
        </span>
      </span>
      <span className="l3d-label" aria-hidden="true">{label}</span>
    </button>
  );
}
