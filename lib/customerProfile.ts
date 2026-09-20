import {
  defaultGuestAvatarUrl,
  isGuestAvatarUrl,
} from "@/lib/guestAvatars";

export type CustomerProfile = {
  name: string;
  /** Public path e.g. /images/avatar/avatar-man1.webp */
  avatarUrl?: string | null;
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
    const avatarUrl =
      typeof parsed.avatarUrl === "string" && isGuestAvatarUrl(parsed.avatarUrl)
        ? parsed.avatarUrl
        : null;
    return { name, avatarUrl };
  } catch {
    return null;
  }
}

export function writeCustomerProfile(profile: CustomerProfile): CustomerProfile {
  const avatarUrl =
    typeof profile.avatarUrl === "string" && isGuestAvatarUrl(profile.avatarUrl)
      ? profile.avatarUrl
      : defaultGuestAvatarUrl();
  const next: CustomerProfile = {
    name: profile.name.trim().slice(0, 15),
    avatarUrl,
  };
  if (typeof window !== "undefined" && next.name) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("customer-profile-changed"));
  }
  return next;
}

export function clearCustomerProfile(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("customer-profile-changed"));
}
