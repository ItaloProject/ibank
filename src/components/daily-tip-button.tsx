"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { tipOfTheDay } from "@/lib/daily-tip";

function todayLabel() {
  const label = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DailyTipButton() {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState("");
  const [date, setDate] = useState("");

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setTip(tipOfTheDay());
          setDate(todayLabel());
          setOpen(true);
        }}
      >
        <Lightbulb className="h-4 w-4 text-[#C2A878]" />
        Dica
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Conteúdo transparente e sem overflow: o rato sobrepõe a borda superior do cartão dourado. */}
        <DialogContent className="max-w-sm gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none sm:p-0 [&>button]:hidden">
          <style>{`@keyframes muvo-float{0%,100%{transform:translateY(-3px)}50%{transform:translateY(3px)}}@media (prefers-reduced-motion:no-preference){.muvo-float{animation:muvo-float 3.4s ease-in-out infinite}}`}</style>
          <div className="relative flex flex-col items-center pt-[70px]">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[-6px] h-[200px] w-[200px] -translate-x-1/2 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(194,168,120,0.16), transparent 70%)" }}
            />
            <div
              className="relative flex w-full flex-col items-center rounded-[28px] border border-[#C2A878]/30 px-6 pb-6 pt-[76px] text-center shadow-[0_0_50px_-14px_rgba(194,168,120,0.22)]"
              style={{ background: "linear-gradient(180deg, #1d1a15 0%, #151412 38%, #111111 100%)" }}
            >
              <div className="flex items-center gap-1.5 text-[#C2A878]">
                <Lightbulb className="h-4 w-4" />
                <DialogTitle className="text-xs font-bold uppercase leading-none tracking-[0.2em] text-[#C2A878]">
                  Dica do dia
                </DialogTitle>
              </div>
              <p className="mt-1 text-sm text-zinc-400">{date}</p>
              <span aria-hidden className="mt-2 h-10 font-serif text-5xl font-bold leading-[1.1] text-[#C2A878]/55">
                “
              </span>
              <DialogDescription className="text-lg font-medium leading-7 text-zinc-100 sm:text-xl sm:leading-8">
                {tip}
              </DialogDescription>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-6 h-12 w-full rounded-[14px] bg-[#C2A878] text-base font-bold text-[#17130b] transition-colors hover:bg-[#CDB88E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E0D2B0]"
              >
                Entendi
              </button>
            </div>
            <Image
              src="/bot/muvo-xadrez.webp"
              alt="Muvo pensando na jogada"
              width={800}
              height={644}
              priority
              className="muvo-float pointer-events-none absolute left-1/2 top-0 h-[132px] w-auto -translate-x-1/2 select-none"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
