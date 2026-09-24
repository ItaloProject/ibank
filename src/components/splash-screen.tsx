"use client";

import { useEffect, useRef } from "react";

export function SplashScreen() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <video
        ref={ref}
        src="/loading.mp4"
        muted
        playsInline
        loop
        autoPlay
        className="h-full w-full object-cover"
      />
    </div>
  );
}
