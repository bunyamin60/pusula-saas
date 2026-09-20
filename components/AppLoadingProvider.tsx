"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { readCustomerProfile } from "@/lib/customerProfile";
import { readOrCreateClientId, readOrCreateIdentity } from "@/lib/duel";

const BOOT_MIN_MS = 1200;
const NAV_HOLD_MS = 1300;

type AppLoadingContextValue = {
  isAppLoading: boolean;
  isNavigating: boolean;
  beginNavigation: (holdMs?: number) => void;
  navigateWithLoading: (href: string, holdMs?: number) => void;
};

const AppLoadingContext = createContext<AppLoadingContextValue | null>(null);

export function useAppLoading(): AppLoadingContextValue {
  const ctx = useContext(AppLoadingContext);
  if (!ctx) {
    throw new Error("useAppLoading must be used within AppLoadingProvider");
  }
  return ctx;
}

export function useOptionalAppLoading(): AppLoadingContextValue | null {
  return useContext(AppLoadingContext);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function AppLoadingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [bootDone, setBootDone] = useState(false);
  const [navActive, setNavActive] = useState(false);
  const navTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    async function boot() {
      try {
        readOrCreateClientId();
        readOrCreateIdentity();
        readCustomerProfile();
      } catch {
        // Local bootstrap is best-effort.
      }

      const remain = Math.max(0, BOOT_MIN_MS - (Date.now() - started));
      if (remain > 0) await wait(remain);
      if (!cancelled) setBootDone(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearNavTimer = useCallback(() => {
    if (navTimerRef.current != null) {
      window.clearTimeout(navTimerRef.current);
      navTimerRef.current = null;
    }
  }, []);

  const beginNavigation = useCallback(
    (holdMs = NAV_HOLD_MS) => {
      clearNavTimer();
      setNavActive(true);
      navTimerRef.current = window.setTimeout(() => {
        setNavActive(false);
        navTimerRef.current = null;
      }, holdMs);
    },
    [clearNavTimer],
  );

  const navigateWithLoading = useCallback(
    (href: string, holdMs = NAV_HOLD_MS) => {
      beginNavigation(holdMs);
      router.push(href);
    },
    [beginNavigation, router],
  );

  useEffect(() => () => clearNavTimer(), [clearNavTimer]);

  const isAppLoading = !bootDone;
  const showOverlay = isAppLoading || navActive;

  const value = useMemo(
    () => ({
      isAppLoading,
      isNavigating: navActive,
      beginNavigation,
      navigateWithLoading,
    }),
    [beginNavigation, isAppLoading, navActive, navigateWithLoading],
  );

  return (
    <AppLoadingContext.Provider value={value}>
      {showOverlay ? <LoadingScreen /> : null}
      {bootDone ? children : null}
    </AppLoadingContext.Provider>
  );
}
