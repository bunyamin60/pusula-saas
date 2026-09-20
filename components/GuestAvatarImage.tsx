"use client";

import Image from "next/image";

/** Assets are square with a white disc + black corners — zoom until black is gone. */
const AVATAR_FILL_CLASS =
  "object-cover object-center scale-[1.42]";

type GuestAvatarImageProps = {
  src: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

export function GuestAvatarImage({
  src,
  sizes,
  className = "",
  priority = false,
}: GuestAvatarImageProps) {
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      className={`${AVATAR_FILL_CLASS} ${className}`.trim()}
    />
  );
}
