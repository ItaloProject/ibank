"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tipOfTheDay } from "@/lib/daily-tip";

/** Botão "Dica": abre a dica financeira do dia (muda todo dia). */
export function DailyTipButton() {
  const [open, setOpen] = useState(false);
  // Calculada ao abrir, para acompanhar a virada do dia sem recarregar a página.
  const [tip, setTip] = useState("");

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setTip(tipOfTheDay());
          setOpen(true);
        }}
      >
        <Lightbulb className="h-4 w-4 text-amber-500" />
        Dica
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Dica do dia
            </DialogTitle>
            <DialogDescription className="text-base text-foreground">{tip}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
