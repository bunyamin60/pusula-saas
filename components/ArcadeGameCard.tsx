"use client";

import { useState } from "react";
import type { ArcadeGame } from "@/lib/gameCatalog";

type ArcadeGameCardProps = {
  game: ArcadeGame;
  title: string;
  badge: string;
  caption: string;
  onClick: () => void;
};

export function ArcadeGameCard({
  game,
  title,
  badge,
  caption,
  onClick,
}: ArcadeGameCardProps) {
  const [imageError, setImageError] = useState(false);
  const Icon = game.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] p-4 text-left shadow-sm transition-transform duration-150 active:scale-[0.96]"
    >
      <span className="relative z-10 flex max-w-[62%] flex-col items-start gap-2">
        <span className="font-sans text-base font-extrabold tracking-tight text-[var(--text-headline)]">
          {title}
        </span>
        <span className="inline-flex rounded-full bg-[var(--btn-primary)]/30 px-2 py-0.5 font-sans text-[11px] font-bold leading-none text-[var(--text-headline)]">
          {badge}
        </span>
        <span className="text-xs font-medium leading-snug text-[var(--text-body)]/80 line-clamp-1">
          {caption}
        </span>
      </span>
      <span className="pointer-events-none absolute -right-2 -bottom-2 z-0 h-28 w-28">
        {imageError ? (
          <Icon
            aria-hidden
            className="h-full w-full object-contain object-bottom-right text-[var(--text-headline)]/25 drop-shadow-md"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.image}
            alt=""
            onError={() => setImageError(true)}
            className="h-full w-full object-contain object-bottom-right drop-shadow-md"
          />
        )}
      </span>
    </button>
  );
}
