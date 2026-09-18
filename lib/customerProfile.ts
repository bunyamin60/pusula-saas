export type CustomerProfile = {
  name: string;
};

const STORAGE_KEY = "customer_profile";

export function readCustomerProfile(): CustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomerProfile> & {
      phone?: string;
    };
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (!name) return null;
    return { name };
  } catch {
    return null;
  }
}

export function writeCustomerProfile(profile: CustomerProfile): CustomerProfile {
  const next = { name: profile.name.trim().slice(0, 15) };
  if (typeof window !== "undefined" && next.name) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearCustomerProfile(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
