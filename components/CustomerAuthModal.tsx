"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { tenantConfig } from "@/config/tenant.config";
import { writeCustomerProfile, type CustomerProfile } from "@/lib/customerProfile";

type CustomerAuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (profile: CustomerProfile) => void;
};

export function CustomerAuthModal({
  open,
  onClose,
  onSaved,
}: CustomerAuthModalProps) {
  const copy = tenantConfig.copy.landing;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = writeCustomerProfile({ name, phone });
    if (!next.name || !next.phone) return;
    onSaved(next);
    setName("");
    setPhone("");
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label={tenantConfig.copy.playReward.close}
            onClick={onClose}
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--text-headline)_40%,transparent)]"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-auth-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="relative z-10 w-full max-w-md rounded-t-3xl border border-ink/15 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-lift"
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-surface" />
            <div className="mt-2 flex items-start justify-between gap-3">
              <h2
                id="customer-auth-title"
                className="font-sans text-2xl font-extrabold leading-tight tracking-tight text-ink"
              >
                {copy.authTitle}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={tenantConfig.copy.playReward.close}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink/20 bg-background text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={submit} className="mt-5 space-y-3">
              <label className="block">
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {copy.authName}
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  className="field-input mt-2"
                />
              </label>
              <label className="block">
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {copy.authPhone}
                </span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  required
                  className="field-input mt-2"
                />
              </label>
              <button type="submit" className="btn-primary mt-2 w-full">
                {copy.authSubmit}
              </button>
            </form>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
