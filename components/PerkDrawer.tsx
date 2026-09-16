"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { PinModal } from "@/components/PinModal";
import { InstagramIcon } from "@/components/SocialLinks";
import { tenantConfig } from "@/config/tenant.config";
import { logCampaignEvent } from "@/lib/analytics";
import { getActiveTenantId } from "@/lib/campaignState";
import {
  loadLoyalty,
  makePerkCode,
  markRedeemed,
  markReviewed,
} from "@/lib/loyalty";
import { useCampaign } from "@/lib/useCampaign";

type PerkDrawerProps = {
  onClose: () => void;
  productName?: string;
};

export function PerkDrawer({ onClose, productName }: PerkDrawerProps) {
  const copy = tenantConfig.copy.reward;
  const playCopy = tenantConfig.copy.playReward;
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const google = campaign.googleReviewUrl || tenantConfig.reward.googleReviewUrl;
  const instagram = campaign.instagramUrl || tenantConfig.reward.instagramUrl;
  const opened = loadLoyalty(tenantId);
  const [code, setCode] = useState(opened.code ?? "");
  const [used, setUsed] = useState(opened.isRedeemed);
  const [openedRedeemed] = useState(opened.isRedeemed);
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (opened.code) return;
    const next = markReviewed(tenantId);
    setCode(next.code ?? makePerkCode(tenantId));
  }, [opened.code, tenantId]);

  function onPinSuccess() {
    void logCampaignEvent(tenantId, "reward_redeemed", productName);
    const nextCode = code || makePerkCode(tenantId);
    const next = markRedeemed(tenantId, nextCode);
    setCode(next.code ?? nextCode);
    setPinOpen(false);
    setUsed(true);
  }

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
        <CouponCard
          code={code}
          used={used}
          previouslyRedeemed={openedRedeemed}
          title={copy.couponReadyTitle}
          thanks=""
          body={copy.cashierHint}
          alreadyUsedNotice={copy.alreadyUsedNotice}
          staffCta={copy.couponStaffCta}
          stamp={copy.couponUsedStamp}
          instagramUrl={instagram}
          followCta={copy.instagramFollowCta}
          googleUrl={google}
          googleLabel={playCopy.googleOptional}
          onStaff={() => setPinOpen(true)}
        />
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
  googleUrl,
  googleLabel,
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
  googleUrl?: string;
  googleLabel: string;
  onStaff: () => void;
}) {
  return (
    <div className="pb-5">
      {previouslyRedeemed ? (
        <p className="text-center text-sm font-medium leading-relaxed text-ink">
          {alreadyUsedNotice}
        </p>
      ) : used || !thanks ? null : (
        <p className="text-center text-sm font-medium leading-relaxed text-ink">{thanks}</p>
      )}
      <div className="play-reward-code-glow relative mt-5 overflow-hidden rounded-3xl border border-primary/40 bg-surface px-5 py-6 text-center">
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
          <p className="mt-4 text-sm font-medium leading-relaxed text-ink">{body}</p>
        )}
        {used ? (
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
          className="mt-5 w-full rounded-2xl bg-primary px-4 py-4 font-display text-lg leading-snug text-on-primary shadow-lift"
        >
          {staffCta}
        </button>
      )}
      {googleUrl ? (
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center text-xs font-medium text-ink/70 underline decoration-primary/30 underline-offset-4"
        >
          {googleLabel}
        </a>
      ) : null}
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
