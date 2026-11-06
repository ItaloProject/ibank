"use client";

import type { CSSProperties } from "react";
import "./live-icons-3d.css";

export type Icon3DKind = "overview" | "wallet" | "calculator" | "rebalance";

/** Traço alinhado ao Lucide (stroke ~2 em viewBox 24 ≈ 5.3 em 64). */
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 5.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Shapes({ kind }: { kind: Icon3DKind }) {
  switch (kind) {
    case "overview":
      return (
        <>
          <rect className="l3d-part l3d-p1" x="8" y="8" width="22" height="28" rx="5" {...STROKE} />
          <rect className="l3d-part l3d-p2" x="36" y="8" width="20" height="16" rx="5" {...STROKE} />
          <rect className="l3d-part l3d-p3" x="8" y="42" width="22" height="14" rx="5" {...STROKE} />
          <rect className="l3d-part l3d-p4" x="36" y="30" width="20" height="26" rx="5" {...STROKE} />
        </>
      );
    case "wallet":
      return (
        <>
          <path
            className="l3d-part l3d-body"
            d="M10 22.5h40a6 6 0 0 1 6 6v21a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6h28"
            {...STROKE}
          />
          <path className="l3d-part l3d-money" d="M14 12.5h30a4 4 0 0 1 4 4v6" {...STROKE} />
          <circle className="l3d-part l3d-dot" cx="46" cy="40" r="2.4" fill="currentColor" stroke="none" />
        </>
      );
    case "rebalance":
      return (
        <>
          <path d="M32 10v44" {...STROKE} />
          <path d="M16 54h32" {...STROKE} />
          <g className="l3d-beam">
            <path d="M10 20h44" {...STROKE} />
            <path d="M18 20v10" {...STROKE} />
            <path d="M46 20v10" {...STROKE} />
            <path d="M10 30a10 10 0 0 0 16 0" {...STROKE} />
            <path d="M38 30a10 10 0 0 0 16 0" {...STROKE} />
          </g>
          <circle cx="32" cy="10" r="3.2" fill="currentColor" stroke="none" />
        </>
      );
    case "calculator":
      return (
        <>
          <rect x="12" y="6" width="40" height="52" rx="8" {...STROKE} />
          <rect className="l3d-part l3d-digits" x="20" y="14" width="24" height="10" rx="3" {...STROKE} />
          {[0, 1, 2].map((row) =>
            [0, 1, 2].map((col) => (
              <circle
                key={`${row}-${col}`}
                className="l3d-part l3d-key"
                cx={22 + col * 10}
                cy={34 + row * 10}
                r="2.2"
                fill="currentColor"
                stroke="none"
                style={{ "--d": `${((row * 3 + col) * 0.08).toFixed(2)}s` } as CSSProperties}
              />
            )),
          )}
        </>
      );
  }
}

/**
 * Ícone 2D do menu do Live: traço leve (estilo Lucide), label sempre visível,
 * feedback de hover/clique. Nome Icon3D mantido por compatibilidade.
 */
export function Icon3D({ kind, label, index, onSelect }: { kind: Icon3DKind; label: string; index: number; onSelect: () => void }) {
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
            <svg viewBox="0 0 64 64">
              <Shapes kind={kind} />
            </svg>
          </span>
        </span>
      </span>
      <span className="l3d-label" aria-hidden="true">{label}</span>
    </button>
  );
}
