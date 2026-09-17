"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { tenantConfig } from "@/config/tenant.config";
import {
  STAMP_GOAL,
  confirmStampVisit,
  loadStampCard,
  type StampCardState,
} from "@/lib/stampCard";

export function LoyaltyStampCard({
  tenantId,
  clientId,
  tableId,
}: {
  tenantId: string;
  clientId: string;
  tableId: string;
}) {
  const copy = tenantConfig.copy.landing.stamps;
  const brand = tenantConfig.brand.wordmark;
  const [card, setCard] = useState<StampCardState>({ count: 0, lastCode: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadStampCard(tenantId, clientId).then((next) => {
      if (active) setCard(next);
    });
    return () => {
      active = false;
    };
  }, [clientId, tenantId]);

  async function confirmVisit() {
    if (busy) return;
    setBusy(true);
    const next = await confirmStampVisit({ tenantId, clientId, tableId });
    setCard(next);
    setBusy(false);
  }

  return (
    <section className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card-surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-base font-black text-[var(--text-headline)]">
        <h2 className="min-w-0 font-sans tracking-tight">
          {copy.title.replace("{brand}", brand)}
        </h2>
        <span className="shrink-0 rounded-full bg-[var(--btn-primary)] px-2.5 py-1 font-sans text-[10px] font-extrabold text-[var(--btn-text)]">
          {copy.badge
            .replace("{count}", String(card.count))
            .replace("{max}", String(STAMP_GOAL))}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-[var(--text-body)]">
        {copy.lead.replaceAll("{brand}", brand)}
      </p>

      <ol className="mt-4 flex items-end justify-between gap-1.5">
        {Array.from({ length: STAMP_GOAL }, (_, index) => {
          const slot = index + 1;
          const filled = card.count >= slot;
          const isGift = slot === STAMP_GOAL;
          return (
            <li key={slot} className="relative flex flex-1 flex-col items-center">
              {isGift ? (
                <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-[var(--btn-primary)] px-1.5 py-0.5 font-sans text-[8px] font-black uppercase tracking-wide text-[var(--btn-text)]">
                  <Gift className="size-2.5" aria-hidden />
                  {copy.gift}
                </span>
              ) : (
                <span className="mb-1 h-4" aria-hidden />
              )}
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${
                  filled
                    ? "scale-105 bg-[var(--btn-primary)] font-black text-[var(--btn-text)] shadow-md"
                    : "border-2 border-dashed border-[var(--border)] bg-black/5 font-bold text-[var(--text-body)]/40"
                }`}
              >
                {filled ? <CoffeeMark /> : slot}
              </span>
            </li>
          );
        })}
      </ol>

      {card.lastCode ? (
        <p className="mt-3 rounded-2xl bg-[var(--btn-primary)]/20 px-3 py-2 text-center font-sans text-xs font-bold text-[var(--text-headline)]">
          {copy.rewarded.replace("{code}", card.lastCode)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void confirmVisit()}
        disabled={busy}
        className="mt-4 min-h-12 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3 font-sans text-sm font-extrabold text-[var(--btn-text)] shadow-sm transition hover:brightness-95 active:scale-95 disabled:opacity-50"
      >
        {busy ? copy.busy : copy.demo}
      </button>
    </section>
  );
}

function CoffeeMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <path
        d="M4.5 9.2h11.2c.6 0 1.1.5 1.1 1.1v4.2A5.3 5.3 0 0 1 11.5 20h-1.6A5.3 5.3 0 0 1 4.6 14.5V10.3c0-.6.5-1.1 1-1.1Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M16.7 10.4h1.4c1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5h-1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M8 5.2c.4 1 .2 1.8-.3 2.6M11.2 4.8c.5 1.1.2 2-.4 2.9M14.2 5.3c.4 1 .1 1.8-.4 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
