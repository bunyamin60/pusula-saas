"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDuel } from "@/components/DuelProvider";
import { GuestAvatarImage } from "@/components/GuestAvatarImage";
import { tenantConfig } from "@/config/tenant.config";
import { readCustomerProfile } from "@/lib/customerProfile";
import { isGuestAvatarUrl } from "@/lib/guestAvatars";
import {
  LOBBY_TAB_EVENT,
  readLobbyTab,
  writeLobbyTab,
  writeVenueHomeView,
  type LobbyTab,
} from "@/lib/venueHome";

type DockItem =
  | { id: LobbyTab; kind: "lobby"; label: string }
  | { id: "profile"; kind: "profile"; label: string };

export function GuestDock() {
  const copy = tenantConfig.copy.landing.dock;
  const { tenantId } = useDuel();
  const pathname = usePathname();
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [lobbyTab, setLobbyTab] = useState<LobbyTab>(() =>
    readLobbyTab(tenantId),
  );
  const base = `/${tenantId}`;
  const profileHref = `${base}/profile`;
  const onLobby =
    pathname === base || pathname === `${base}/` || pathname === `${base}`;
  const onProfile = Boolean(pathname?.startsWith(profileHref));

  const items: DockItem[] = [
    { id: "games", kind: "lobby", label: copy.games },
    { id: "events", kind: "lobby", label: copy.events },
    { id: "surveys", kind: "lobby", label: copy.surveys },
    { id: "profile", kind: "profile", label: copy.profile },
  ];

  useEffect(() => {
    function syncProfile() {
      const profile = readCustomerProfile();
      setAvatarUrl(
        profile?.avatarUrl && isGuestAvatarUrl(profile.avatarUrl)
          ? profile.avatarUrl
          : null,
      );
    }
    syncProfile();
    window.addEventListener("customer-profile-changed", syncProfile);
    window.addEventListener("storage", syncProfile);
    return () => {
      window.removeEventListener("customer-profile-changed", syncProfile);
      window.removeEventListener("storage", syncProfile);
    };
  }, [pathname]);

  useEffect(() => {
    setLobbyTab(readLobbyTab(tenantId));
    function onTab(event: Event) {
      const detail = (event as CustomEvent<{ tenantId: string; tab: LobbyTab }>)
        .detail;
      if (!detail || detail.tenantId !== tenantId) return;
      setLobbyTab(detail.tab);
    }
    window.addEventListener(LOBBY_TAB_EVENT, onTab);
    return () => window.removeEventListener(LOBBY_TAB_EVENT, onTab);
  }, [tenantId]);

  function goLobby(tab: LobbyTab) {
    writeLobbyTab(tenantId, tab);
    writeVenueHomeView(tenantId, "lobby");
    if (!onLobby) router.push(base);
  }

  return (
    <nav
      className="absolute inset-x-3 z-50 rounded-full border border-[var(--border)] bg-[var(--bg-canvas)]/90 p-1.5 shadow-xl backdrop-blur-md"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => {
          const active =
            item.kind === "profile"
              ? onProfile
              : onLobby && lobbyTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.kind === "profile") {
                  if (active) return;
                  router.push(profileHref);
                  return;
                }
                if (active) return;
                goLobby(item.id);
              }}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-full px-1 py-2.5 text-center font-sans text-[11px] leading-tight tracking-wide transition-colors active:scale-95 ${
                active
                  ? "bg-[var(--tab-active-bg)] font-bold text-[var(--tab-active-text)]"
                  : "bg-transparent font-semibold text-[var(--text-body)]"
              }`}
            >
              {item.kind === "profile" && avatarUrl ? (
                <span className="relative size-6 shrink-0 overflow-hidden rounded-full border border-[var(--btn-text)]/50 shadow-sm">
                  <GuestAvatarImage src={avatarUrl} sizes="24px" />
                </span>
              ) : null}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
