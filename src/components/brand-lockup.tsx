import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLockupProps {
  className?: string;
  /** "auto" follows the theme; "onDark" is for surfaces that stay dark in both themes. */
  tone?: "auto" | "onDark";
  priority?: boolean;
}

export function BrandLockup({ className, tone = "auto", priority }: BrandLockupProps) {
  const size = { width: 960, height: 267 };

  if (tone === "onDark") {
    return (
      <Image src="/brand/muvo-lockup-dark.png" alt="MUVO" {...size}
        className={cn("w-auto shrink-0", className)} priority={priority} />
    );
  }

  return (
    <>
      <Image src="/brand/muvo-lockup-light.png" alt="MUVO" {...size}
        className={cn("w-auto shrink-0 dark:hidden", className)} priority={priority} />
      <Image src="/brand/muvo-lockup-dark.png" alt="MUVO" {...size}
        className={cn("w-auto shrink-0 hidden dark:block", className)} priority={priority} />
    </>
  );
}
