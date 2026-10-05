"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskMoney, parseMoneyMask, toMoneyMask } from "@/lib/money-mask";

export interface MoneyInputProps extends Omit<InputProps, "value" | "defaultValue" | "onChange" | "type"> {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
}

/** Campo de valor em reais: os dígitos entram pela direita (405807 vira 4.058,07) e o valor sai como número. */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, className, placeholder = "0,00", onFocus, onBlur, ...props }, ref) => {
    const [text, setText] = React.useState(() => toMoneyMask(value));
    const focused = React.useRef(false);

    React.useEffect(() => {
      if (!focused.current) setText(toMoneyMask(value));
    }, [value]);

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        className={cn("tabular-nums", className)}
        value={text}
        onChange={(e) => {
          const masked = maskMoney(e.target.value);
          setText(masked);
          onValueChange(parseMoneyMask(masked));
        }}
        onFocus={(e) => {
          focused.current = true;
          const end = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(end, end);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";
