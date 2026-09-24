"use client";

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading.gif"
        alt=""
        className="w-28 h-28 object-contain"
        style={{ imageRendering: "auto" }}
      />
      <div className="h-0.5 w-36 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full bg-amber-400 animate-[loading-bar_1.8s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
