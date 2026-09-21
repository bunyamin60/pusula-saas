"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useDuel } from "@/components/DuelProvider";
import { GuestAvatarImage } from "@/components/GuestAvatarImage";
import { tenantConfig } from "@/config/tenant.config";
import type { CustomerProfile } from "@/lib/customerProfile";
import {
  defaultGuestAvatarUrl,
  GUEST_AVATAR_OPTIONS,
  type GuestAvatarUrl,
} from "@/lib/guestAvatars";
import {
  isValidPin,
  normalizeNickname,
  normalizePin,
  signInWithNicknamePin,
} from "@/lib/guestAuth";

type CustomerAuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (profile: CustomerProfile) => void;
  title?: string;
  submitLabel?: string;
};

export function CustomerAuthModal({
  open,
  onClose,
  onSaved,
  title,
  submitLabel,
}: CustomerAuthModalProps) {
  const copy = tenantConfig.copy.landing;
  const { tenantId, player, chooseIdentity } = useDuel();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<GuestAvatarUrl>(defaultGuestAvatarUrl());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setAvatarUrl(defaultGuestAvatarUrl());
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nickname = normalizeNickname(name);
    const nextPin = normalizePin(pin);
    if (!nickname || !isValidPin(nextPin)) {
      setError(copy.authInvalid);
      return;
    }

    setBusy(true);
    setError(null);
    const result = await signInWithNicknamePin({
      tenantId,
      clientId: player.clientId,
      nickname,
      pin: nextPin,
      avatarUrl,
    });
    setBusy(false);

    if (!result.ok) {
      if (result.reason === "bad_pin") {
        setError(copy.authPinError);
        return;
      }
      if (result.reason === "invalid") {
        setError(copy.authInvalid);
        return;
      }
      if (result.reason === "taken") {
        setError(copy.authTaken);
        return;
      }
      setError(copy.authOffline);
      return;
    }

    chooseIdentity({
      nickname: result.profile.name,
      avatar: player.avatar,
    });
    onSaved(result.profile);
    setName("");
    setPin("");
    setAvatarUrl(defaultGuestAvatarUrl());
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
            className="relative z-10 w-full max-w-md rounded-t-3xl border border-[var(--border)] bg-[var(--bg-canvas)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-lift"
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[var(--card-surface)]" />
            <div className="mt-2 flex items-start justify-between gap-3">
              <h2
                id="customer-auth-title"
                className="font-sans text-2xl font-extrabold leading-tight tracking-tight text-[var(--text-headline)]"
              >
                {title?.trim() || copy.authTitle}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={tenantConfig.copy.playReward.close}
                className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-headline)] transition active:scale-95"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-3">
              <div>
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
                  {copy.authAvatar}
                </p>
                <div className="hide-scrollbar mt-2 flex gap-4 overflow-x-auto px-1 pb-2 pt-1.5 snap-x snap-mandatory">
                  {GUEST_AVATAR_OPTIONS.map((src) => {
                    const selected = avatarUrl === src;
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setAvatarUrl(src)}
                        aria-pressed={selected}
                        aria-label={copy.authAvatar}
                        className={`relative size-16 shrink-0 snap-center rounded-full transition-transform active:scale-95 ${
                          selected
                            ? "ring-4 ring-[var(--btn-primary)] ring-offset-2 ring-offset-[var(--bg-canvas)]"
                            : "ring-2 ring-[var(--border)] ring-offset-2 ring-offset-[var(--bg-canvas)]"
                        }`}
                      >
                        <span className="absolute inset-0 overflow-hidden rounded-full bg-[var(--card-surface)]">
                          <GuestAvatarImage src={src} sizes="64px" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
                  {copy.authName}
                </span>
                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value.slice(0, 15))
                  }
                  autoComplete="nickname"
                  maxLength={15}
                  required
                  placeholder={copy.authNamePlaceholder}
                  className="field-input mt-2 min-h-12"
                  onFocus={(event) => {
                    event.currentTarget.scrollIntoView({
                      block: "center",
                      behavior: "smooth",
                    });
                  }}
                />
              </label>
              <label className="block">
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
                  {copy.authPin}
                </span>
                <input
                  value={pin}
                  onChange={(event) =>
                    setPin(normalizePin(event.target.value))
                  }
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={4}
                  required
                  placeholder={copy.authPinPlaceholder}
                  className="field-input mt-2 min-h-12 tracking-[0.35em]"
                  onFocus={(event) => {
                    event.currentTarget.scrollIntoView({
                      block: "center",
                      behavior: "smooth",
                    });
                  }}
                />
              </label>
              {error ? (
                <p
                  role="alert"
                  className="rounded-2xl bg-[var(--quiz-bad)]/15 px-3 py-2.5 text-center font-sans text-sm font-bold text-[var(--quiz-bad)]"
                >
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? copy.authBusy : submitLabel?.trim() || copy.authSubmit}
              </button>
            </form>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
