/** Local guest avatar assets under /public/images/avatar */
export const GUEST_AVATAR_OPTIONS = [
  "/images/avatar/avatar-man1.webp",
  "/images/avatar/avatar-man2.webp",
  "/images/avatar/avatar-man3.webp",
  "/images/avatar/avatar-women1.webp",
  "/images/avatar/avatar-women2.webp",
  "/images/avatar/avatar-women3.webp",
] as const;

export type GuestAvatarUrl = (typeof GUEST_AVATAR_OPTIONS)[number];

export function isGuestAvatarUrl(value: string | null | undefined): value is GuestAvatarUrl {
  return Boolean(value && (GUEST_AVATAR_OPTIONS as readonly string[]).includes(value));
}

export function defaultGuestAvatarUrl(): GuestAvatarUrl {
  return GUEST_AVATAR_OPTIONS[0];
}
