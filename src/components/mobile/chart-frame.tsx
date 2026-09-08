"use client";

import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export function ChartFrame({
  children,
  aspect = "square",
  className,
  minHeight = 180,
}: {
  children: React.ReactElement;
  aspect?: "square" | "wide" | "tall";
  className?: string;
  minHeight?: number;
}) {
  const aspectClass =
    aspect === "wide" ? "aspect-[16/9]" : aspect === "tall" ? "aspect-[3/4]" : "aspect-square";

  return (
    <div
      className={cn("w-full max-w-full min-w-0", aspectClass, className)}
      style={{ minHeight }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
