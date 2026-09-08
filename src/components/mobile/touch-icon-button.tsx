"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Icon button with ≥44px hit area on mobile. */
export const TouchIconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "icon", variant = "ghost", ...props }, ref) => (
    <Button
      ref={ref}
      size={size}
      variant={variant}
      className={cn("shrink-0 touch-manipulation", className)}
      {...props}
    />
  ),
);
TouchIconButton.displayName = "TouchIconButton";
