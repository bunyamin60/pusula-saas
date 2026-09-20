"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { GuestAvatarImage } from "@/components/GuestAvatarImage";
import { GuestShell } from "@/components/GuestShell";
import { useDuel } from "@/components/DuelProvider";
import { usePlayReward } from "@/components/PlayRewardProvider";
import { tenantConfig } from "@/config/tenant.config";
import { getActiveTenantId } from "@/lib/campaignState";
import {
  readCustomerProfile,
  type CustomerProfile,
} from "@/lib/customerProfile";
import { wipeGuestLocalData } from "@/lib/guestWipe";
import { getActiveTableLabel } from "@/lib/tableSession";
import { useCampaign } from "@/lib/useCampaign";
import { writeVenueHomeView } from "@/lib/venueHome";

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
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const router = useRouter();
  const { player, chooseIdentity } = useDuel();
  const { claimedCode } = usePlayReward();
  const campaign = useCampaign();
  const copy = tenantConfig.copy.landing;
  const tableName = getActiveTableLabel(tenantId);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    setProfile(readCustomerProfile());
  }, []);

  useEffect(() => {
    if (!isConfirming) return;
    const timer = window.setTimeout(() => setIsConfirming(false), 5000);
    return () => window.clearTimeout(timer);
  }, [isConfirming]);

  function goLobby() {
    writeVenueHomeView(tenantId, "lobby");
    router.push(`/${tenantId}`);
  }

  async function saveToPhone() {
    if (!claimedCode) return;
    setSaveFailed(false);
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
      setSaveFailed(true);
    }
  }

  function logout() {
    wipeGuestLocalData(tenantId);
    setProfile(null);
    chooseIdentity({ nickname: copy.profileGuest, avatar: player.avatar });
  }

  function deleteAccount() {
    wipeGuestLocalData(tenantId);
    setProfile(null);
    chooseIdentity({ nickname: copy.profileGuest, avatar: player.avatar });
    setIsConfirming(false);
    setToast(copy.profileDeleteDone);
    window.setTimeout(() => window.location.reload(), 900);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 font-sans text-lg font-extrabold tracking-tight text-[var(--text-headline)]">
          {copy.dock.profile}
        </h1>
        <button
          type="button"
          onClick={goLobby}
          aria-label={copy.welcomeBack}
          className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] px-3 font-sans text-sm font-bold text-[var(--text-headline)] transition-transform active:scale-95 active:brightness-95"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {copy.welcomeBack}
        </button>
      </div>

      <article className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-surface)] p-5 shadow-sm">
        <div className="flex items-center gap-4">
          {profile?.avatarUrl ? (
            <span className="relative size-20 shrink-0 overflow-hidden rounded-full border-4 border-[var(--bg-canvas)] shadow-md">
              <GuestAvatarImage src={profile.avatarUrl} sizes="80px" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="font-sans text-2xl font-extrabold tracking-tight text-[var(--text-headline)]">
              {profile ? profile.name : copy.profileGuest}
            </h2>
            <p className="mt-2 font-sans text-sm font-medium leading-relaxed text-[var(--text-body)]">
              {copy.profileLead}
            </p>
          </div>
        </div>
        {profile ? (
          <button
            type="button"
            onClick={logout}
            className="mt-4 min-h-12 w-full rounded-2xl border border-[var(--text-headline)]/20 px-4 py-3 font-sans text-sm font-bold text-[var(--text-headline)] transition hover:bg-[var(--bg-canvas)] active:scale-95"
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
        <p className="mt-1.5 font-sans text-lg font-extrabold text-[var(--text-headline)]">
          {tableName}
        </p>
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
        className="btn-primary min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saved && claimedCode ? copy.profileSaveDone : copy.profileSave}
      </button>
      {saveFailed ? (
        <p className="font-sans text-sm font-medium text-[var(--text-body)]">
          {copy.profileSaveFailed}
        </p>
      ) : null}

      {isConfirming ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={deleteAccount}
            className="min-h-12 w-full rounded-2xl bg-[var(--quiz-bad)] px-4 py-3 font-sans text-sm font-bold text-[var(--quiz-on-feedback)] shadow-sm transition active:scale-95 active:brightness-95"
          >
            {copy.profileDeleteConfirm}
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            className="min-h-12 w-full rounded-2xl bg-[var(--card-surface)] px-4 py-3 font-sans text-sm font-medium text-[var(--text-body)] transition active:scale-95 active:brightness-95"
          >
            {copy.profileDeleteCancel}
          </button>
        </div>
      ) : profile ? (
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className="min-h-12 w-full rounded-2xl border border-[var(--border)] px-4 py-3 font-sans text-sm font-bold text-[var(--text-headline)] transition hover:brightness-95 active:scale-95"
        >
          {copy.profileDelete}
        </button>
      ) : null}

      {toast ? (
        <p
          role="status"
          className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[70] mx-auto w-full max-w-md rounded-2xl bg-[var(--text-headline)] px-4 py-3 text-center font-sans text-sm font-bold text-[var(--bg-canvas)] shadow-lg"
        >
          {toast}
        </p>
      ) : null}

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
