"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { tenantConfig } from "@/config/tenant.config";
import { formatCountdown, msUntil } from "@/lib/economy";

export function StampProofScreen({
  open,
  code,
  expiresAt,
  onClose,
}: {
  open: boolean;
  code: string;
  expiresAt: string;
  onClose: () => void;
}) {
  const copy = tenantConfig.copy.landing.stamps;
  const [mounted, setMounted] = useState(false);
  const [leftMs, setLeftMs] = useState(() => msUntil(expiresAt));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const tick = () => {
      const next = msUntil(expiresAt);
      setLeftMs(next);
      if (next <= 0) onClose();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [expiresAt, onClose, open]);

  if (!mounted) return null;

  const progress = Math.max(0, Math.min(1, leftMs / (3 * 60_000)));
  const hueShift = Math.floor((1 - progress) * 40);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--bg-canvas)] px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal
          aria-label={copy.proofTitle}
        >
          <motion.div
            className="flex w-full max-w-md flex-col items-center text-center"
            animate={{
              scale: [1, 1.02, 1],
              filter: [`hue-rotate(0deg)`, `hue-rotate(${hueShift}deg)`, `hue-rotate(0deg)`],
            }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="font-sans text-xs font-black uppercase tracking-[0.2em] text-[var(--text-body)]">
              {copy.proofKicker}
            </p>
            <h2 className="mt-2 font-sans text-xl font-extrabold text-[var(--text-headline)]">
              {copy.proofTitle}
            </h2>
            <motion.p
              className="mt-8 font-sans text-7xl font-black tabular-nums tracking-tight text-[var(--text-headline)]"
              animate={{ opacity: [1, 0.7, 1], y: [0, -4, 0] }}
              transition={{ duration: 1.1, repeat: Infinity }}
            >
              {code}
            </motion.p>
            <p className="mt-4 font-sans text-sm font-bold tabular-nums text-[var(--text-body)]">
              {copy.proofTimer.replace("{time}", formatCountdown(leftMs))}
            </p>
            <p className="mt-6 max-w-xs font-sans text-sm font-medium leading-relaxed text-[var(--text-body)]">
              {copy.proofLead}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-8 min-h-12 w-full max-w-xs rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] px-4 font-sans text-sm font-extrabold text-[var(--text-headline)] transition active:scale-95"
            >
              {copy.proofClose}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
