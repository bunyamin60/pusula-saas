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
import { LoadingScreen } from "@/components/LoadingScreen";
import { readCustomerProfile } from "@/lib/customerProfile";
import { readOrCreateClientId, readOrCreateIdentity } from "@/lib/duel";

const BOOT_MIN_MS = 900;
/** Show loader only if a guarded async job is still pending after this delay. */
const SLOW_DELAY_MS = 650;

type NetworkConnection = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type AppLoadingContextValue = {
  isAppLoading: boolean;
  /** Show loader only if the work stays pending past the slow threshold. */
  runWithSlowGuard: <T>(work: () => Promise<T>) => Promise<T>;
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

function readConnection(): NetworkConnection | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function isSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!navigator.onLine) return true;
  const connection = readConnection();
  if (!connection) return false;
  if (connection.saveData) return true;
  const type = connection.effectiveType;
  return type === "slow-2g" || type === "2g";
}

export function AppLoadingProvider({ children }: { children: ReactNode }) {
  const [bootDone, setBootDone] = useState(false);
  const [jobSlow, setJobSlow] = useState(false);
  const pendingJobs = useRef(0);
  const slowTimerRef = useRef<number | null>(null);

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

  const clearSlowTimer = useCallback(() => {
    if (slowTimerRef.current != null) {
      window.clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
  }, []);

  const runWithSlowGuard = useCallback(
    async <T,>(work: () => Promise<T>): Promise<T> => {
      pendingJobs.current += 1;
      if (pendingJobs.current === 1) {
        clearSlowTimer();
        // Only surface the full-screen loader when the network truly drags.
        const delay =
          isSlowConnection() || !navigator.onLine ? 200 : SLOW_DELAY_MS;
        slowTimerRef.current = window.setTimeout(() => {
          if (pendingJobs.current > 0) setJobSlow(true);
        }, delay);
      }
      try {
        return await work();
      } finally {
        pendingJobs.current = Math.max(0, pendingJobs.current - 1);
        if (pendingJobs.current === 0) {
          clearSlowTimer();
          setJobSlow(false);
        }
      }
    },
    [clearSlowTimer],
  );

  useEffect(() => () => clearSlowTimer(), [clearSlowTimer]);

  const isAppLoading = !bootDone;
  const showOverlay = isAppLoading || jobSlow;

  const value = useMemo(
    () => ({
      isAppLoading,
      runWithSlowGuard,
    }),
    [isAppLoading, runWithSlowGuard],
  );

  return (
    <AppLoadingContext.Provider value={value}>
      {showOverlay ? <LoadingScreen /> : null}
      {bootDone ? children : null}
    </AppLoadingContext.Provider>
  );
}
