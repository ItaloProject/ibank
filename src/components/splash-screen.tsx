"use client";

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-5">
      {/* dark:invert inverte o GIF: fundo branco→preto, rato preto→branco */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading.gif"
        alt=""
        className="w-32 h-32 object-contain"
      />
      <div className="h-[2px] w-40 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full bg-amber-400 animate-[loading-bar_1.8s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
