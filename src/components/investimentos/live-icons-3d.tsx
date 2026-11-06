"use client";

import { useRef, type CSSProperties, type ForwardRefExoticComponent, type RefAttributes } from "react";
import "./live-icons-3d.css";

export type Icon3DKind = "overview" | "wallet" | "calculator" | "rebalance";

type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type AnimatedIcon = ForwardRefExoticComponent<
  { size?: number; className?: string } & RefAttributes<AnimatedIconHandle>
>;

/**
 * Tile do menu Live com ícone animado (lucide-animated / Motion).
 * Spell.sh não tem pack de ícones — usamos a lib animada baseada em Lucide + Motion.
 */
export function Icon3D({
  icon: Icon,
  label,
  index,
  onSelect,
}: {
  icon: AnimatedIcon;
  label: string;
  index: number;
  onSelect: () => void;
}) {
  const iconRef = useRef<AnimatedIconHandle>(null);

  return (
    <button
      type="button"
      className="l3d"
      aria-label={label}
      onClick={onSelect}
      onPointerEnter={() => iconRef.current?.startAnimation()}
      onPointerLeave={() => iconRef.current?.stopAnimation()}
      style={{ "--i": index } as CSSProperties}
    >
      <span className="l3d-float" aria-hidden="true">
        <span className="l3d-scene">
          <span className="l3d-glyph">
            <Icon ref={iconRef} size={44} className="l3d-glyph-icon" />
          </span>
        </span>
      </span>
      <span className="l3d-label" aria-hidden="true">{label}</span>
    </button>
  );
}
