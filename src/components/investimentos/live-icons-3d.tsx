"use client";

import { useId, type CSSProperties, type PointerEvent } from "react";
import "./live-icons-3d.css";

export type Icon3DKind = "overview" | "wallet" | "calculator";

/** Uma cópia frontal e as demais empilhadas em profundidade, o que dá volume ao símbolo. */
const LAYERS = 11;
const STEP_PX = 2;

const REST = { rx: 10, ry: -12 };
const TILT_RANGE = 15;

function Shapes({ kind, fill }: { kind: Icon3DKind; fill: string }) {
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
          <rect className="l3d-edge" x="41" y="30" width="20" height="16" rx="8" fill={fill} />
          <circle className="l3d-part l3d-dot l3d-cut" cx="50" cy="38" r="2.6" />
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
              style={{ "--d": `${(n * 0.11).toFixed(2)}s` } as CSSProperties}
            />
          ))}
        </>
      );
  }
}

function resetTilt(el: HTMLElement) {
  el.removeAttribute("data-tracking");
  for (const p of ["--rx", "--ry", "--mx", "--my"]) el.style.removeProperty(p);
}

/**
 * Ícone 3D do menu do Live: a placa e o símbolo inclinam seguindo o cursor, o brilho acompanha a
 * luz e, ao passar o mouse, o símbolo sobe da placa e faz a sua própria animação.
 */
export function Icon3D({ kind, label, index, onSelect }: { kind: Icon3DKind; label: string; index: number; onSelect: () => void }) {
  const gradientId = `l3d-${useId().replace(/:/g, "")}`;

  function onMove(e: PointerEvent<HTMLButtonElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = e.currentTarget;
    const box = el.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((e.clientX - box.left) / box.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - box.top) / box.height) * 2 - 1));
    el.setAttribute("data-tracking", "");
    el.style.setProperty("--ry", `${(REST.ry + nx * TILT_RANGE).toFixed(1)}deg`);
    el.style.setProperty("--rx", `${(REST.rx - ny * TILT_RANGE).toFixed(1)}deg`);
    el.style.setProperty("--mx", `${((nx + 1) * 50).toFixed(0)}%`);
    el.style.setProperty("--my", `${((ny + 1) * 50).toFixed(0)}%`);
  }

  return (
    <button
      type="button"
      className="l3d"
      aria-label={label}
      onClick={onSelect}
      onPointerMove={onMove}
      onPointerLeave={(e) => resetTilt(e.currentTarget)}
      onBlur={(e) => resetTilt(e.currentTarget)}
      style={{ "--i": index } as CSSProperties}
    >
      <span className="l3d-float" aria-hidden="true">
        <span className="l3d-scene">
          <span className="l3d-shadow" />
          <span className="l3d-slab l3d-slab--back" />
          <span className="l3d-slab l3d-slab--mid" />
          <span className="l3d-slab l3d-slab--top">
            <span className="l3d-glare" />
          </span>
          <span className="l3d-cast" />
          <span className="l3d-glyph">
            {Array.from({ length: LAYERS }, (_, n) => (
              <svg
                key={n}
                className="l3d-layer"
                viewBox="0 0 64 64"
                style={{
                  transform: `translateZ(${(-n * STEP_PX).toFixed(1)}px)`,
                  color: `color-mix(in srgb, hsl(var(--foreground)) ${Math.max(16, 58 - n * 5)}%, hsl(var(--card)))`,
                }}
              >
                {n === 0 && (
                  <defs>
                    <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="8" y1="4" x2="56" y2="62">
                      <stop offset="0" style={{ stopColor: "hsl(var(--foreground))" }} />
                      <stop offset="1" style={{ stopColor: "color-mix(in srgb, hsl(var(--foreground)) 60%, hsl(var(--card)))" }} />
                    </linearGradient>
                  </defs>
                )}
                <Shapes kind={kind} fill={n === 0 ? `url(#${gradientId})` : "currentColor"} />
              </svg>
            ))}
          </span>
        </span>
      </span>
      <span className="l3d-label" aria-hidden="true">{label}</span>
    </button>
  );
}
