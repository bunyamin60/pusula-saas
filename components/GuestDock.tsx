"use client";

import { usePathname, useRouter } from "next/navigation";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";

export function GuestDock() {
  const copy = tenantConfig.copy.landing.dock;
  const { tenantId } = useDuel();
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${tenantId}`;
  const items = [
    { id: "games", href: base, label: copy.games },
    { id: "profile", href: `${base}/profile`, label: copy.profile },
  ] as const;

  return (
    <nav
      className="fixed bottom-4 z-50 w-[min(24rem,calc(100%-2rem))] rounded-full border border-ink/15 bg-background/90 p-1.5 shadow-xl backdrop-blur-md"
      style={{
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
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
              onClick={() => router.push(item.href)}
              className={`rounded-full px-2 py-3 text-center font-sans text-[12px] leading-tight tracking-wide transition-colors ${
                active
                  ? "bg-[var(--tab-active-bg)] font-bold text-[var(--tab-active-text)]"
                  : "bg-transparent font-semibold text-[var(--text-body)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
