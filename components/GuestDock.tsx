"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDuel } from "@/components/DuelProvider";
import { GuestAvatarImage } from "@/components/GuestAvatarImage";
import { tenantConfig } from "@/config/tenant.config";
import { readCustomerProfile } from "@/lib/customerProfile";
import { isGuestAvatarUrl } from "@/lib/guestAvatars";
import { writeVenueHomeView } from "@/lib/venueHome";

export function GuestDock() {
  const copy = tenantConfig.copy.landing.dock;
  const { tenantId } = useDuel();
  const pathname = usePathname();
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const base = `/${tenantId}`;
  const items = [
    { id: "games", href: base, label: copy.games },
    { id: "profile", href: `${base}/profile`, label: copy.profile },
  ] as const;

  useEffect(() => {
    function sync() {
      const profile = readCustomerProfile();
      setAvatarUrl(
        profile?.avatarUrl && isGuestAvatarUrl(profile.avatarUrl)
          ? profile.avatarUrl
          : null,
      );
    }
    sync();
    window.addEventListener("customer-profile-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("customer-profile-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [pathname]);

  return (
    <nav
      className="absolute inset-x-4 z-50 rounded-full border border-[var(--border)] bg-[var(--bg-canvas)]/90 p-1.5 shadow-xl backdrop-blur-md"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-2 gap-1">
        {items.map((item) => {
          const active =
            item.id === "games"
              ? pathname === base || pathname === `${base}/`
              : pathname?.startsWith(item.href);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "games") writeVenueHomeView(tenantId, "lobby");
                if (active) return;
                router.push(item.href);
              }}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-full px-2 py-3 text-center font-sans text-[12px] leading-tight tracking-wide transition-colors ${
                active
                  ? "bg-[var(--tab-active-bg)] font-bold text-[var(--tab-active-text)]"
                  : "bg-transparent font-semibold text-[var(--text-body)]"
              }`}
            >
              {item.id === "profile" && avatarUrl ? (
                <span className="relative size-7 shrink-0 overflow-hidden rounded-full border border-[var(--btn-text)]/50 shadow-sm">
                  <GuestAvatarImage src={avatarUrl} sizes="28px" />
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
