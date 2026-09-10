"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Delete, X } from "lucide-react";
import { tenantConfig } from "@/config/tenant.config";

type PinModalProps = {
  expectedPin: string;
  onClose: () => void;
  onSuccess: () => void;
  embedded?: boolean;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export function PinModal({
  expectedPin,
  onClose,
  onSuccess,
  embedded = false,
}: PinModalProps) {
  const copy = tenantConfig.copy.pinModal;
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const checkPin = useCallback(
    (pin: string) => {
      setBusy(true);
      if (pin === expectedPin) {
        setSuccess(true);
        window.setTimeout(onSuccess, 720);
        return;
      }
      setError(true);
      window.setTimeout(() => {
        setDigits("");
        setError(false);
        setBusy(false);
      }, 520);
    },
    [expectedPin, onSuccess],
  );

  const addDigit = useCallback(
    (digit: string) => {
      if (busy || success) return;
      setDigits((current) => {
        if (current.length >= 4) return current;
        const next = `${current}${digit}`;
        if (next.length === 4) {
          window.setTimeout(() => checkPin(next), 30);
        }
        return next;
      });
      setError(false);
    },
    [busy, checkPin, success],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (busy || success) return;
      if (event.key === "Backspace") {
        event.preventDefault();
        setDigits((value) => value.slice(0, -1));
        setError(false);
        return;
      }
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        addDigit(event.key);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addDigit, busy, embedded, onClose, success]);

  const pad = (
    <div
      role={embedded ? "group" : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-labelledby="pin-modal-title"
      className={
        embedded
          ? "w-full"
          : "w-full max-w-sm rounded-2xl bg-background px-5 pb-6 pt-4 shadow-lift"
      }
    >
      {embedded ? (
        <h3 id="pin-modal-title" className="text-center font-display text-lg text-ink">
          {copy.title}
        </h3>
      ) : (
        <div className="flex items-center justify-between">
          <h2 id="pin-modal-title" className="font-display text-xl text-ink">
            {copy.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full bg-surface text-ink"
            aria-label={copy.close}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <p className="mt-3 text-sm leading-relaxed text-muted">{copy.warning}</p>

      {success ? (
        <div className="flex flex-col items-center py-8">
          <span className="flex size-16 items-center justify-center rounded-full bg-perfect text-white">
            <Check className="size-8" />
          </span>
          <p className="mt-4 font-display text-lg text-ink">{copy.success}</p>
        </div>
      ) : (
        <>
          <div className={`mt-6 flex justify-center gap-2.5 ${error ? "pin-shake" : ""}`}>
            {Array.from({ length: 4 }, (_, index) => (
              <span
                key={index}
                className={`flex size-12 items-center justify-center rounded-2xl font-display text-xl ${
                  error
                    ? "bg-red-100 text-red-700"
                    : digits[index]
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-muted"
                }`}
              >
                {digits[index] ? "•" : ""}
              </span>
            ))}
          </div>

          <p
            className={`mt-3 min-h-5 text-center text-sm ${error ? "text-red-700" : "text-transparent"}`}
            aria-live="polite"
          >
            {copy.error}
          </p>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {KEYS.map((key, index) => {
              if (key === "") {
                return <span key={`empty-${index}`} />;
              }
              if (key === "del") {
                return (
                  <button
                    key="del"
                    type="button"
                    onClick={() => {
                      if (busy) return;
                      setDigits((value) => value.slice(0, -1));
                      setError(false);
                    }}
                    className="flex h-14 items-center justify-center rounded-2xl bg-surface text-ink"
                    aria-label={copy.deleteLabel}
                  >
                    <Delete className="size-5" />
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => addDigit(key)}
                  className="h-14 rounded-2xl bg-surface font-display text-xl text-ink active:bg-primary active:text-on-primary"
                >
                  {key}
                </button>
              );
            })}
          </div>

          {!embedded ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full py-3 text-center text-sm text-muted"
            >
              {copy.cancel}
            </button>
          ) : null}
        </>
      )}
    </div>
  );

  if (embedded) return pad;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center">
      {pad}
    </div>
  );
}
