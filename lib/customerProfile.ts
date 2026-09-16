export type CustomerProfile = {
  name: string;
  phone: string;
};

const STORAGE_KEY = "customer_profile";

export function readCustomerProfile(): CustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomerProfile>;
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const phone = typeof parsed.phone === "string" ? parsed.phone.trim() : "";
    if (!name || !phone) return null;
    return { name, phone };
  } catch {
    return null;
  }
}

export function writeCustomerProfile(profile: CustomerProfile): CustomerProfile {
  const next = {
    name: profile.name.trim(),
    phone: profile.phone.trim(),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearCustomerProfile(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
