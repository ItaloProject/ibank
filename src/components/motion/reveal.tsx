"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Surge de baixo para cima quando entra na tela, uma vez. */
export function Reveal({ children, className, delay = 0, y = 28 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Conta de 0 até `value` quando entra na tela; depois acompanha as mudanças de valor. */
export function useCountUp(value: number, active: boolean, duration = 1.4): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    if (!active) return;
    const controls = animate(from.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, active, duration, reduce]);
  return shown;
}

/** Anel de progresso (0 a 100) que preenche ao entrar na tela. `children` fica centralizado. */
export function ProgressRing({ size, radius, stroke, progress, color, trackColor = "hsl(var(--foreground) / 0.12)", duration = 1.4, children }: {
  size: number;
  radius?: number;
  stroke: number;
  progress: number;
  color: string;
  trackColor?: string;
  duration?: number;
  children?: (inView: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const r = radius ?? (size - stroke) / 2 - 2;
  const circ = 2 * Math.PI * r;
  const target = circ * (1 - Math.max(0, Math.min(100, progress)) / 100);
  const style: CSSProperties = { width: size, height: size };
  return (
    <div ref={ref} className="relative flex items-center justify-center" style={style}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: trackColor }} />
        {progress > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            style={{ stroke: color }}
            initial={{ strokeDashoffset: reduce ? target : circ }}
            animate={{ strokeDashoffset: inView || reduce ? target : circ }}
            transition={{ duration: reduce ? 0 : duration, ease: EASE_OUT }}
          />
        )}
      </svg>
      {children?.(inView || !!reduce)}
    </div>
  );
}
