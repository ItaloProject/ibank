"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center text-zinc-100">
          <p className="text-lg font-semibold">Algo deu errado</p>
          <p className="text-sm text-zinc-400">Recarregue a página. Se o problema continuar, entre em contato pelo WhatsApp de suporte.</p>
        </div>
      </body>
    </html>
  );
}
