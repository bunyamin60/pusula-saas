"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { GuestShell } from "@/components/GuestShell";
import { useDuel } from "@/components/DuelProvider";
import { usePlayReward } from "@/components/PlayRewardProvider";
import { tenantConfig } from "@/config/tenant.config";
import { getActiveTenantId } from "@/lib/campaignState";
import {
  clearCustomerProfile,
  readCustomerProfile,
  type CustomerProfile,
} from "@/lib/customerProfile";
import { useCampaign } from "@/lib/useCampaign";

export default function ProfilePage() {
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();

  return (
    <GuestShell tenantId={tenantId}>
      <ProfileCard />
    </GuestShell>
  );
}

function ProfileCard() {
  const { player, chooseIdentity } = useDuel();
  const { claimedCode } = usePlayReward();
  const campaign = useCampaign();
  const copy = tenantConfig.copy.landing;
  const tableName = tenantConfig.brand.tableName || copy.gameShell.tableFallback;
  const [saved, setSaved] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    setProfile(readCustomerProfile());
  }, []);

  async function saveToPhone() {
    if (!claimedCode) return;
    const text = `${campaign.brandName || tenantConfig.brand.name} · ${copy.profileCouponsLabel}: ${claimedCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: copy.profileSave, text });
        setSaved(true);
        return;
      }
    } catch {
      // Fall through to clipboard when share is cancelled or unavailable.
    }
    try {
      await navigator.clipboard.writeText(claimedCode);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  function logout() {
    clearCustomerProfile();
    setProfile(null);
    chooseIdentity({ nickname: copy.profileGuest, avatar: player.avatar });
  }

  return (
    <section className="flex flex-col gap-3">
      <article className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-surface)] p-5 shadow-sm">
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-[var(--text-headline)]">
          {profile ? profile.name : copy.profileGuest}
        </h1>
        <p className="mt-2 font-sans text-sm font-medium leading-relaxed text-[var(--text-body)]">
          {copy.profileLead}
        </p>
        {profile ? (
          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full rounded-2xl border border-[var(--text-headline)]/20 px-4 py-3 font-sans text-sm font-bold text-[var(--text-headline)] transition hover:bg-[var(--bg-canvas)]"
          >
            {copy.profileLogout}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="btn-primary mt-4 w-full"
          >
            {copy.loginCta}
          </button>
        )}
      </article>

      <article className="rounded-3xl border border-[var(--card-border)] bg-[var(--bg-canvas)] p-5 shadow-sm">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
          {copy.profileTableLabel}
        </p>
        <p className="mt-1.5 font-sans text-lg font-extrabold text-[var(--text-headline)]">{tableName}</p>
      </article>

      <article className="rounded-3xl border border-[var(--card-border)] bg-[var(--bg-canvas)] p-5 shadow-sm">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
          {copy.profileCouponsLabel}
        </p>
        {claimedCode ? (
          <p className="mt-3 rounded-2xl bg-[var(--card-surface)] px-4 py-3 font-mono text-2xl font-black tracking-[0.12em] text-[var(--text-headline)]">
            {claimedCode}
          </p>
        ) : (
          <p className="mt-2 font-sans text-sm font-medium leading-relaxed text-[var(--text-body)]">
            {copy.profileCouponsEmpty}
          </p>
        )}
      </article>

      <button
        type="button"
        onClick={saveToPhone}
        disabled={!claimedCode}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saved && claimedCode ? copy.profileSaveDone : copy.profileSave}
      </button>

      <CustomerAuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSaved={(next) => {
          setProfile(next);
          chooseIdentity({ nickname: next.name, avatar: player.avatar });
        }}
      />
    </section>
  );
}
