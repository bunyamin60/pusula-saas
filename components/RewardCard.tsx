"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { PinModal } from "@/components/PinModal";
import { SocialLinks } from "@/components/SocialLinks";
import { tenantConfig } from "@/config/tenant.config";
import { useCampaign } from "@/lib/useCampaign";
import {
  canRestartAfterReward,
  formatRewardCode,
  isLockedReward,
  type RewardSession,
} from "@/lib/session";

const VERIFY_MS = 10_000;
const STAR_COUNT = 5;
const STAR_PATH =
  "M12 2.1 14.86 8.2l6.64.74-4.9 4.55 1.36 6.51L12 16.9l-5.96 3.1 1.36-6.51-4.9-4.55 6.64-.74L12 2.1z";

type RewardCardProps = {
  reward: RewardSession;
  onUnlock: () => void;
  onRedeem: () => void;
  onRestart: () => void;
  onHome: () => void;
};

export function RewardCard({
  reward,
  onUnlock,
  onRedeem,
  onRestart,
  onHome,
}: RewardCardProps) {
  const copy = tenantConfig.copy.reward;
  const campaign = useCampaign();
  const [now, setNow] = useState(() => Date.now());
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    if (isLockedReward(reward)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [reward]);

  const remaining = Math.max(0, reward.expiresAt - now);
  const expired = !isLockedReward(reward) && remaining <= 0;
  const used = Boolean(reward.usedAt);
  const restartable = canRestartAfterReward(reward, now);

  if (used) {
    return (
      <ClaimedCard
        code={reward.code}
        locked={!restartable}
        onRestart={onRestart}
        onHome={onHome}
      />
    );
  }

  if (expired) {
    return (
      <StatusCard
        title={copy.expiredTitle}
        body={copy.expiredBody}
        code={reward.code}
        actionLabel={copy.homeCta}
        onAction={onHome}
      />
    );
  }

  return (
    <>
      <SocialGate
        alreadyVerified={!isLockedReward(reward)}
        onUnlock={onUnlock}
        onRequestPin={() => setPinOpen(true)}
        onHome={onHome}
      />
      {pinOpen ? (
        <PinModal
          expectedPin={campaign.baristaPin}
          onClose={() => setPinOpen(false)}
          onSuccess={() => {
            setPinOpen(false);
            onRedeem();
          }}
        />
      ) : null}
    </>
  );
}

type GateStep = "initial" | "returned" | "verifying" | "verified";

function statusForStars(
  filledStars: number,
  copy: (typeof tenantConfig)["copy"]["reward"],
): string {
  if (filledStars >= STAR_COUNT) return copy.gateStarsVerified;
  if (filledStars >= 3) return copy.gateStarsContent;
  if (filledStars === 2) return copy.gateStarsReview;
  if (filledStars === 1) return copy.gateStarsProfile;
  return copy.gateStarsCheck;
}

function FlowStar({ fill }: { fill: number }) {
  const uid = useId().replace(/:/g, "");
  const clipId = `star-flow-${uid}`;
  const amount = Math.min(1, Math.max(0, fill));
  const rise = (1 - amount) * 24;
  const glowing = amount > 0.08;
  const complete = amount >= 0.995;

  return (
    <span
      className={`inline-flex transition-transform duration-300 ${
        complete ? "scale-110" : "scale-100"
      }`}
      style={
        glowing
          ? { filter: "drop-shadow(0 0 10px rgba(251,191,36,0.6))" }
          : undefined
      }
    >
      <svg viewBox="0 0 24 24" className="size-11" aria-hidden>
        <defs>
          <clipPath id={clipId}>
            <path d={STAR_PATH} />
          </clipPath>
        </defs>
        <path
          d={STAR_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y={rise} width="24" height="24" fill="#FBBF24" />
        </g>
        {complete ? (
          <path
            d={STAR_PATH}
            fill="none"
            stroke="#FCD34D"
            strokeWidth="1.15"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </span>
  );
}

function SocialGate({
  alreadyVerified,
  onUnlock,
  onRequestPin,
  onHome,
}: {
  alreadyVerified: boolean;
  onUnlock: () => void;
  onRequestPin: () => void;
  onHome: () => void;
}) {
  const copy = tenantConfig.copy.reward;
  const campaign = useCampaign();
  const google = campaign.googleReviewUrl || tenantConfig.reward.googleReviewUrl;
  const [step, setStep] = useState<GateStep>(alreadyVerified ? "verified" : "initial");
  const [fillProgress, setFillProgress] = useState(alreadyVerified ? STAR_COUNT : 0);
  const unlockedRef = useRef(alreadyVerified);

  useEffect(() => {
    if (step !== "verifying") return;

    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / VERIFY_MS);
      setFillProgress(t * STAR_COUNT);
      if (t < 1) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      setFillProgress(STAR_COUNT);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (step !== "verifying" || fillProgress < STAR_COUNT || unlockedRef.current) return;
    unlockedRef.current = true;
    setStep("verified");
    onUnlock();
  }, [fillProgress, onUnlock, step]);

  function openGoogleReview() {
    if (step !== "initial") return;
    window.open(google, "_blank");
    setStep("returned");
  }

  function startVerification() {
    if (step !== "returned") return;
    setFillProgress(0);
    setStep("verifying");
  }

  const filledStars = Math.min(STAR_COUNT, Math.floor(fillProgress + 0.001));
  const status = statusForStars(filledStars, copy);
  const showStars = step === "verifying" || step === "verified";

  return (
    <section className="flex flex-1 flex-col">
      <article className="relative mt-2 overflow-hidden rounded-2xl bg-surface px-5 py-8 text-center shadow-lift">
        {step === "verified" ? (
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--perfect)_22%,white)] text-[var(--perfect)] shadow-[0_0_24px_color-mix(in_srgb,var(--perfect)_45%,transparent)]">
            <Check className="size-8" strokeWidth={2.6} />
          </span>
        ) : (
          <>
            <h2 className="font-display text-2xl text-ink">{copy.gateTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {step === "returned" ? copy.gateReturnedBody : copy.gateBody}
            </p>
          </>
        )}

        {showStars ? (
          <div className={`rounded-2xl bg-ink/90 px-3 py-5 ${step === "verified" ? "mt-5" : "mt-6"}`}>
            <div className="flex items-center justify-center gap-2" role="img" aria-label={status}>
              {Array.from({ length: STAR_COUNT }).map((_, index) => (
                <FlowStar key={index} fill={fillProgress - index} />
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/80">{status}</p>
          </div>
        ) : null}

        {step === "verified" ? (
          <button
            type="button"
            onClick={onRequestPin}
            className="mt-5 w-full rounded-2xl bg-primary px-4 py-4 font-display text-lg leading-snug text-on-primary shadow-[0_0_28px_color-mix(in_srgb,var(--primary)_65%,transparent)] transition-transform active:scale-[0.99]"
          >
            {copy.gatePinCta}
          </button>
        ) : null}
      </article>

      <div className="mt-auto space-y-3 pt-8">
        {step === "initial" ? (
          <button
            type="button"
            onClick={openGoogleReview}
            className="btn-primary w-full px-4 py-4"
          >
            {copy.gateStepGoogle}
          </button>
        ) : null}
        {step === "returned" ? (
          <button
            type="button"
            onClick={startVerification}
            className="w-full rounded-2xl bg-primary px-4 py-4 font-display text-lg leading-snug text-on-primary shadow-[0_0_28px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition-transform active:scale-[0.99]"
          >
            {copy.gateStepConfirm}
          </button>
        ) : null}
        <button type="button" onClick={onHome} className="w-full py-2 text-sm text-muted">
          {copy.homeCta}
        </button>
      </div>
    </section>
  );
}

function ClaimedCard({
  code,
  locked,
  onRestart,
  onHome,
}: {
  code: string;
  locked: boolean;
  onRestart: () => void;
  onHome: () => void;
}) {
  const copy = tenantConfig.copy.reward;

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-surface px-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="size-7" />
        </span>
        <h2 className="mt-5 font-display text-2xl text-ink">{copy.enjoyTitle}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {locked ? copy.lockedBody : copy.usedBody}
        </p>
        <p className="mt-5 font-display text-xl tracking-wide text-ink">
          {formatRewardCode(code)}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <SocialLinks variant="claimed" />
        <button type="button" onClick={onHome} className="btn-primary w-full">
          {copy.homeCta}
        </button>
        {!locked ? (
          <button type="button" onClick={onRestart} className="btn-secondary w-full">
            {copy.restartCta}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function StatusCard({
  title,
  body,
  code,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  code: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-surface px-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="size-7" />
        </span>
        <h2 className="mt-5 font-display text-2xl text-ink">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
        <p className="mt-5 font-display text-xl tracking-wide text-ink">
          {formatRewardCode(code)}
        </p>
      </div>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="btn-primary mt-6 w-full">
          {actionLabel}
        </button>
      )}
    </section>
  );
}
