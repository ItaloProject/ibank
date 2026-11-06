"use client";

import type { CSSProperties } from "react";
import "./live-icons-3d.css";

export type Icon3DKind = "overview" | "wallet" | "calculator" | "rebalance";

function Shapes({ kind }: { kind: Icon3DKind }) {
  const fill = "currentColor";
  switch (kind) {
    case "overview":
      return (
        <>
          <rect className="l3d-part l3d-p1" x="7" y="7" width="26" height="32" rx="6.5" fill={fill} />
          <rect className="l3d-part l3d-p2" x="37" y="7" width="20" height="18" rx="6.5" fill={fill} />
          <rect className="l3d-part l3d-p3" x="7" y="43" width="26" height="14" rx="6.5" fill={fill} />
          <rect className="l3d-part l3d-p4" x="37" y="29" width="20" height="28" rx="6.5" fill={fill} />
        </>
      );
    case "wallet":
      return (
        <>
          <g className="l3d-part l3d-money">
            <rect x="13" y="5" width="36" height="22" rx="4.5" fill={fill} transform="rotate(-7 31 16)" />
            <rect className="l3d-cut" x="21" y="11" width="14" height="3.2" rx="1.6" transform="rotate(-7 31 16)" />
          </g>
          <rect x="5" y="17" width="52" height="41" rx="11" fill={fill} />
          <rect x="41" y="30" width="20" height="16" rx="8" fill={fill} />
          <circle className="l3d-part l3d-dot l3d-cut" cx="50" cy="38" r="2.6" />
        </>
      );
    case "rebalance":
      return (
        <>
          <rect x="29" y="12" width="6" height="42" rx="3" fill={fill} />
          <rect x="15" y="51" width="34" height="9" rx="4.5" fill={fill} />
          <g className="l3d-beam">
            <rect x="6" y="16.5" width="52" height="5" rx="2.5" fill={fill} />
            <rect x="15" y="22" width="2" height="12" fill={fill} />
            <rect x="47" y="22" width="2" height="12" fill={fill} />
            <path d="M4.5 34 H27.5 A11.5 11.5 0 0 1 4.5 34 Z" fill={fill} />
            <path d="M36.5 34 H59.5 A11.5 11.5 0 0 1 36.5 34 Z" fill={fill} />
          </g>
          <circle cx="32" cy="10" r="5" fill={fill} />
        </>
      );
    case "calculator":
      return (
        <>
          <rect x="11" y="3" width="42" height="58" rx="10" fill={fill} />
          <rect className="l3d-cut" x="17" y="9" width="30" height="14" rx="4.5" />
          <rect className="l3d-part l3d-digits" x="29" y="13.5" width="14" height="5" rx="2.5" fill={fill} />
          {Array.from({ length: 9 }, (_, n) => (
            <rect
              key={n}
              className="l3d-part l3d-cut l3d-key"
              x={17 + (n % 3) * 10.6}
              y={29 + Math.floor(n / 3) * 10.2}
              width="8.2"
              height="7.6"
              rx="2.6"
              style={{ "--d": `${(n * 0.09).toFixed(2)}s` } as CSSProperties}
            />
          ))}
        </>
      );
  }
}

/**
 * Ícone 2D do menu do Live: placa plana, símbolo flat e feedback de hover/clique.
 * Mantém o nome Icon3D por compatibilidade com as telas mobile/desktop.
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
