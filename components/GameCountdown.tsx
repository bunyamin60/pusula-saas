"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { tenantConfig } from "@/config/tenant.config";

type GameCountdownProps = {
  onDone: () => void;
  overlay?: boolean;
};

const TICK_MS = 700;

export function GameCountdown({ onDone, overlay = false }: GameCountdownProps) {
  const copy = tenantConfig.copy.landing.gameShell;
  const beats = ["3", "2", "1", copy.countdownGo] as const;
  const [beat, setBeat] = useState(0);
  const onDoneRef = useRef(onDone);
  const finishedRef = useRef(false);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (beat >= beats.length) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onDoneRef.current();
      }
      return;
    }
    const timer = window.setTimeout(() => setBeat((current) => current + 1), TICK_MS);
    return () => window.clearTimeout(timer);
  }, [beat, beats.length]);

  if (beat >= beats.length) return null;

  return (
    <div
      className={
        overlay
          ? "absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md"
          : "flex min-h-0 flex-1 flex-col items-center justify-center"
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {copy.countdownReady}
      </p>
      <AnimatePresence mode="wait">
        <motion.p
          key={beats[beat]}
          initial={{ scale: 0.45, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.35, opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="mt-3 font-sans text-7xl font-extrabold tracking-tight text-ink"
        >
          {beats[beat]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
