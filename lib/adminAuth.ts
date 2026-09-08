import { defaultAdminPassword } from "@/lib/tenant";

type Listener = () => void;

const listeners = new Set<Listener>();
let unlocked = false;

function emit() {
  listeners.forEach((listener) => listener());
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

export function setAdminAuth(next: boolean): void {
  unlocked = next;
  emit();
}

export function lockAdmin(): void {
  setAdminAuth(false);
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
