"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { StampProofScreen } from "@/components/StampProofScreen";
import { tenantConfig } from "@/config/tenant.config";
import {
  STAMP_GOAL,
  createStampRequest,
  fetchEconomyStatus,
  formatCountdown,
  msUntil,
  redeemStampReward,
  type EconomyStatus,
  type StampRequestPayload,
  type VenueMode,
} from "@/lib/economy";
import { getActiveTableLabel } from "@/lib/tableSession";

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
  const [status, setStatus] = useState<EconomyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [askTable, setAskTable] = useState(false);
  const [tableInput, setTableInput] = useState("");
  const [activeRequest, setActiveRequest] = useState<StampRequestPayload | null>(
    null,
  );
  const [leftMs, setLeftMs] = useState(0);
  const [proof, setProof] = useState<{ code: string; expiresAt: string } | null>(
    null,
  );

  const refresh = useCallback(async () => {
    const next = await fetchEconomyStatus(tenantId, clientId);
    if (!next?.ok) return;
    setStatus(next);
    if (next.pending_request) setActiveRequest(next.pending_request);
  }, [clientId, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeRequest) {
      setLeftMs(0);
      return;
    }
    const tick = () => {
      const ms = msUntil(activeRequest.expires_at);
      setLeftMs(ms);
      if (ms <= 0) {
        setActiveRequest(null);
        void refresh();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [activeRequest, refresh]);

  const count = status?.stamp_count ?? 0;
  const venueMode: VenueMode = status?.venue_mode ?? "masa";
  const cooldownMs = msUntil(status?.stamp_cooldown_until);
  const canRequest = cooldownMs <= 0 && !activeRequest && count < STAMP_GOAL;

  async function startRequest(tableLabel?: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await createStampRequest({
      tenantId,
      clientId,
      tableLabel: tableLabel ?? null,
    });
    setBusy(false);
    if (!result.ok) {
      if (result.reason === "cooldown") {
        setNotice(copy.cooldown);
      } else if (result.reason === "table_required") {
        setAskTable(true);
      } else {
        setNotice(copy.offline);
      }
      return;
    }
    setAskTable(false);
    setActiveRequest(result.request);
    void refresh();
  }

  function onRequestClick() {
    if (!canRequest || busy) return;
    if (venueMode === "masa") {
      const known = (tableId || getActiveTableLabel(tenantId) || "").trim();
      if (known) {
        void startRequest(known);
        return;
      }
      setAskTable(true);
      return;
    }
    void startRequest();
  }

  async function onRedeem() {
    if (busy || count < STAMP_GOAL) return;
    setBusy(true);
    setNotice(null);
    const result = await redeemStampReward({ tenantId, clientId });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.reason === "not_enough" ? copy.needMore : copy.offline);
      return;
    }
    setProof({
      code: result.proof.code,
      expiresAt: result.proof.expires_at,
    });
    void refresh();
  }

  return (
    <section className="rounded-3xl border-2 border-[var(--card-border)] bg-[var(--card-surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-base font-black text-[var(--text-headline)]">
        <h2 className="min-w-0 font-sans tracking-tight">
          {copy.title.replace("{brand}", brand)}
        </h2>
        <span className="shrink-0 rounded-full bg-[var(--btn-primary)] px-2.5 py-1 font-sans text-[10px] font-extrabold text-[var(--btn-text)]">
          {copy.badge
            .replace("{count}", String(count))
            .replace("{max}", String(STAMP_GOAL))}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-[var(--text-body)]">
        {copy.lead.replaceAll("{brand}", brand)}
      </p>

      {status ? (
        <p className="mt-2 font-sans text-[11px] font-bold text-[var(--text-body)]">
          {copy.xpLine
            .replace("{earned}", String(status.xp_day_earned))
            .replace("{cap}", String(status.daily_cap))
            .replace("{total}", String(status.xp_total))}
        </p>
      ) : null}

      <ol className="mt-4 flex items-end justify-between gap-1.5">
        {Array.from({ length: STAMP_GOAL }, (_, index) => {
          const slot = index + 1;
          const filled = count >= slot;
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
                className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all sm:h-12 sm:w-12 ${
                  filled
                    ? "scale-105 bg-[var(--btn-primary)] font-black text-[var(--btn-text)] shadow-md"
                    : "border-2 border-dashed border-[var(--card-border)] bg-[var(--bg-canvas)] font-bold text-[var(--text-body)]/40"
                }`}
              >
                {filled ? <CoffeeMark /> : slot}
              </span>
            </li>
          );
        })}
      </ol>

      {activeRequest ? (
        <div className="mt-4 rounded-3xl border border-[var(--card-border)] bg-[var(--bg-canvas)] px-4 py-5 text-center">
          <p className="font-sans text-[11px] font-black uppercase tracking-wider text-[var(--text-body)]">
            {copy.codeKicker}
          </p>
          <p className="mt-2 font-sans text-6xl font-black tabular-nums tracking-tight text-[var(--text-headline)]">
            {activeRequest.code}
          </p>
          <p className="mt-2 font-sans text-sm font-bold tabular-nums text-[var(--text-body)]">
            {copy.codeTimer.replace("{time}", formatCountdown(leftMs))}
          </p>
          {activeRequest.table_label ? (
            <p className="mt-1 font-sans text-xs font-semibold text-[var(--text-body)]">
              {copy.tableLabel.replace("{table}", activeRequest.table_label)}
            </p>
          ) : null}
        </div>
      ) : null}

      {askTable ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!tableInput.trim()) return;
            void startRequest(tableInput.trim());
          }}
        >
          <label className="block font-sans text-xs font-bold text-[var(--text-headline)]">
            {copy.askTable}
            <input
              value={tableInput}
              onChange={(event) => setTableInput(event.target.value.slice(0, 16))}
              className="mt-1.5 w-full rounded-2xl border border-[var(--card-border)] bg-[var(--bg-canvas)] px-4 py-3 font-sans text-sm font-medium text-[var(--text-headline)] outline-none"
              placeholder={copy.askTablePlaceholder}
              inputMode="numeric"
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={busy || !tableInput.trim()}
            className="min-h-12 w-full rounded-2xl bg-[var(--btn-primary)] px-4 font-sans text-sm font-extrabold text-[var(--btn-text)] transition active:scale-95 disabled:opacity-50"
          >
            {copy.requestCta}
          </button>
        </form>
      ) : null}

      {notice ? (
        <p className="mt-3 text-center font-sans text-xs font-semibold text-[var(--text-headline)]">
          {notice}
        </p>
      ) : null}

      {cooldownMs > 0 && !activeRequest ? (
        <p className="mt-3 text-center font-sans text-xs font-medium text-[var(--text-body)]">
          {copy.cooldownTimer.replace("{time}", formatCountdown(cooldownMs))}
        </p>
      ) : null}

      {count >= STAMP_GOAL ? (
        <button
          type="button"
          onClick={() => void onRedeem()}
          disabled={busy}
          className="mt-4 min-h-12 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3 font-sans text-sm font-extrabold text-[var(--btn-text)] shadow-sm transition hover:brightness-95 active:scale-95 disabled:opacity-50"
        >
          {busy ? copy.busy : copy.redeemCta}
        </button>
      ) : !askTable ? (
        <button
          type="button"
          onClick={onRequestClick}
          disabled={busy || !canRequest}
          className="mt-4 min-h-12 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3 font-sans text-sm font-extrabold text-[var(--btn-text)] shadow-sm transition hover:brightness-95 active:scale-95 disabled:opacity-50"
        >
          {busy ? copy.busy : copy.requestCta}
        </button>
      ) : null}

      <StampProofScreen
        open={Boolean(proof)}
        code={proof?.code ?? ""}
        expiresAt={proof?.expiresAt ?? ""}
        onClose={() => setProof(null)}
      />
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
        d="M7 7.2c.2-1 .8-1.7 1.5-1.7M10.2 7c.1-.8.6-1.5 1.3-1.5M13.4 7.3c.2-.9.8-1.5 1.5-1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
