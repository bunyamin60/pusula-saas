"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { PinModal } from "@/components/PinModal";
import { InstagramIcon } from "@/components/SocialLinks";
import { tenantConfig } from "@/config/tenant.config";
import { logCampaignEvent } from "@/lib/analytics";
import { getActiveTenantId } from "@/lib/campaignState";
import { resolveTenantCategory } from "@/lib/landingCopy";
import {
  loadLoyalty,
  makePerkCode,
  markRedeemed,
  markReviewed,
  type LoyaltyStatus,
} from "@/lib/loyalty";
import { useCampaign } from "@/lib/useCampaign";

const VERIFY_MS = 10_000;
const STAR_COUNT = 5;
const STAR_PATH =
  "M12 2.1 14.86 8.2l6.64.74-4.9 4.55 1.36 6.51L12 16.9l-5.96 3.1 1.36-6.51-4.9-4.55 6.64-.74L12 2.1z";

type DrawerStep = "initial" | "verifying" | "coupon";

type PerkDrawerProps = {
  onClose: () => void;
  productName?: string;
};

function initialStep(status: LoyaltyStatus): DrawerStep {
  if (status.isRedeemed || status.hasReviewed) return "coupon";
  return "initial";
}

export function PerkDrawer({ onClose, productName }: PerkDrawerProps) {
  const copy = tenantConfig.copy.reward;
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const google = campaign.googleReviewUrl || tenantConfig.reward.googleReviewUrl;
  const instagram = campaign.instagramUrl || tenantConfig.reward.instagramUrl;
  const bodies = copy.couponReadyBodyByCategory as Record<string, string>;
  const category = resolveTenantCategory(campaign.category);
  const couponBody = bodies[category] ?? bodies.general ?? bodies.lounge;

  const [loyalty, setLoyalty] = useState<LoyaltyStatus>(() => loadLoyalty(tenantId));
  const [openedRedeemed] = useState(() => loadLoyalty(tenantId).isRedeemed);
  const [step, setStep] = useState<DrawerStep>(() => initialStep(loadLoyalty(tenantId)));
  const [fillProgress, setFillProgress] = useState(0);
  const [code, setCode] = useState(loyalty.code ?? "");
  const [used, setUsed] = useState(loyalty.isRedeemed);
  const [pinOpen, setPinOpen] = useState(false);
  const waitingReturn = useRef(false);
  const reviewedRef = useRef(loyalty.hasReviewed);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      if (!waitingReturn.current) return;
      waitingReturn.current = false;
      setFillProgress(0);
      setStep("verifying");
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

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
    if (step !== "verifying" || fillProgress < STAR_COUNT || reviewedRef.current) return;
    reviewedRef.current = true;
    const next = markReviewed(tenantId);
    setLoyalty(next);
    setCode(next.code ?? makePerkCode(tenantId));
    setStep("coupon");
  }, [fillProgress, step, tenantId]);

  function openGoogle() {
    if (step !== "initial") return;
    void logCampaignEvent(tenantId, "google_click");
    waitingReturn.current = true;
    const popup = window.open(google, "_blank");
    if (!popup) {
      waitingReturn.current = false;
      setFillProgress(0);
      setStep("verifying");
    }
  }

  function onPinSuccess() {
    void logCampaignEvent(tenantId, "reward_redeemed", productName);
    const nextCode = code || loyalty.code || makePerkCode(tenantId);
    const next = markRedeemed(tenantId, nextCode);
    setLoyalty(next);
    setCode(next.code ?? nextCode);
    setPinOpen(false);
    setUsed(true);
  }

  const status =
    fillProgress >= STAR_COUNT ? copy.gateStarsVerified : copy.gateVerifying;

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/50"
        aria-label={copy.enjoyClose}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-lift"
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-ink/15" />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full bg-surface text-ink"
            aria-label={copy.enjoyClose}
          >
            <X className="size-4" />
          </button>
        </div>

        {step === "initial" ? (
          <div className="pb-4">
            <h2 className="text-center font-display text-2xl text-ink">{copy.gateTitle}</h2>
            <p className="mt-3 text-center text-sm leading-relaxed text-muted">{copy.gateBody}</p>
            <button type="button" onClick={openGoogle} className="btn-primary mt-6 w-full px-4 py-4">
              {copy.gateStepGoogle}
            </button>
          </div>
        ) : null}

        {step === "verifying" ? (
          <div className="pb-6">
            <h2 className="text-center font-display text-2xl text-ink">{copy.gateTitle}</h2>
            <div className="mt-6 rounded-2xl bg-ink/90 px-3 py-5">
              <div className="flex items-center justify-center gap-2" role="img" aria-label={status}>
                {Array.from({ length: STAR_COUNT }).map((_, index) => (
                  <FlowStar key={index} fill={fillProgress - index} />
                ))}
              </div>
              <p className="mt-4 text-center text-sm leading-relaxed text-white/80">{status}</p>
            </div>
          </div>
        ) : null}

        {step === "coupon" ? (
          <CouponCard
            code={code}
            used={used}
            previouslyRedeemed={openedRedeemed}
            title={copy.couponReadyTitle}
            thanks={copy.gateStarsVerified}
            body={couponBody}
            alreadyUsedNotice={copy.alreadyUsedNotice}
            staffCta={copy.couponStaffCta}
            stamp={copy.couponUsedStamp}
            instagramUrl={instagram}
            followCta={copy.instagramFollowCta}
            onStaff={() => setPinOpen(true)}
          />
        ) : null}
      </motion.div>

      {pinOpen && !used ? (
        <PinModal
          expectedPin={campaign.baristaPin}
          onClose={() => setPinOpen(false)}
          onSuccess={onPinSuccess}
        />
      ) : null}
    </motion.div>
  );
}

function CouponCard({
  code,
  used,
  previouslyRedeemed,
  title,
  thanks,
  body,
  alreadyUsedNotice,
  staffCta,
  stamp,
  instagramUrl,
  followCta,
  onStaff,
}: {
  code: string;
  used: boolean;
  previouslyRedeemed: boolean;
  title: string;
  thanks: string;
  body: string;
  alreadyUsedNotice: string;
  staffCta: string;
  stamp: string;
  instagramUrl?: string;
  followCta: string;
  onStaff: () => void;
}) {
  const showUsedLayout = used;

  return (
    <div className="pb-5">
      {previouslyRedeemed ? (
        <p className="text-center text-sm leading-relaxed text-muted">
          {alreadyUsedNotice}
        </p>
      ) : used ? null : (
        <p className="text-center text-sm leading-relaxed text-muted">{thanks}</p>
      )}
      <div className="relative mt-5 overflow-hidden rounded-3xl border border-primary/40 bg-surface px-5 py-6 text-center shadow-[0_0_32px_color-mix(in_srgb,var(--primary)_35%,transparent)]">
        {previouslyRedeemed ? null : (
          <h2 className="font-display text-[1.55rem] leading-tight text-ink">{title}</h2>
        )}
        {code ? (
          <p
            className={`font-display text-[2rem] tracking-wide text-ink ${
              previouslyRedeemed ? "" : "mt-4"
            }`}
          >
            {code}
          </p>
        ) : null}
        {previouslyRedeemed ? null : (
          <p className="mt-4 text-sm leading-relaxed text-muted">{body}</p>
        )}
        {showUsedLayout ? (
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-xl border-4 border-red-500/90 px-4 py-2 font-display text-2xl uppercase tracking-[0.18em] text-red-500">
            {stamp}
          </span>
        ) : null}
      </div>
      {used ? (
        <InstagramFollowButton href={instagramUrl} label={followCta} />
      ) : (
        <button
          type="button"
          onClick={onStaff}
          className="mt-5 w-full rounded-2xl bg-primary px-4 py-4 font-display text-lg leading-snug text-on-primary shadow-[0_0_28px_color-mix(in_srgb,var(--primary)_65%,transparent)]"
        >
          {staffCta}
        </button>
      )}
    </div>
  );
}

function InstagramFollowButton({
  href,
  label,
}: {
  href?: string;
  label: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-secondary mt-4 flex w-full items-center justify-center gap-2 px-4 py-3.5"
    >
      <InstagramIcon className="size-4" />
      {label}
    </a>
  );
}

function FlowStar({ fill }: { fill: number }) {
  const uid = useId().replace(/:/g, "");
  const clipId = `perk-star-${uid}`;
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
