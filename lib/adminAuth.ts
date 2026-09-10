import { defaultAdminPassword } from "@/lib/tenant";

type Listener = () => void;

const listeners = new Set<Listener>();
let unlocked = false;

function emit() {
  listeners.forEach((listener) => listener());
}

export function adminAuthStorageKey(tenantId: string): string {
  return `admin_auth_${tenantId}`;
}

export function readStoredAdminAuth(tenantId: string): boolean {
  try {
    return sessionStorage.getItem(adminAuthStorageKey(tenantId)) === "true";
  } catch {
    return false;
  }
}

export function subscribeToAdminAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAdminAuth(): boolean {
  return unlocked;
}

export function getServerAdminAuth(): boolean {
  return false;
}

export function setAdminAuth(next: boolean, tenantId?: string): void {
  unlocked = next;
  if (tenantId) {
    try {
      const key = adminAuthStorageKey(tenantId);
      if (next) sessionStorage.setItem(key, "true");
      else sessionStorage.removeItem(key);
    } catch {
      // Private mode may block sessionStorage; in-memory flag still applies.
    }
  }
  emit();
}

export function lockAdmin(tenantId?: string): void {
  setAdminAuth(false, tenantId);
}

export function adminPasswordAccepted(
  input: string,
  options: {
    tenantId: string;
    adminPassword?: string | null;
    baristaPin?: string | null;
  },
): boolean {
  const entered = input.trim();
  if (!entered) return false;
  const stored = options.adminPassword?.trim() ?? "";
  if (stored) return entered === stored;
  const pin = options.baristaPin?.trim() ?? "";
  if (pin && entered === pin) return true;
  const fallback = defaultAdminPassword(options.tenantId);
  return Boolean(fallback) && entered === fallback;
}
