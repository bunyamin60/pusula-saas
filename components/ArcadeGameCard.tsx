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
      className="group relative h-40 cursor-pointer overflow-hidden rounded-3xl border-2 border-[var(--text-headline)]/15 bg-[var(--card-surface)] shadow-[0_5px_0_0_rgba(0,0,0,0.08)] transition-all duration-150 select-none hover:translate-y-[3px] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.08)] active:translate-y-[5px] active:shadow-none"
    >
      <span className="absolute top-3 left-3 z-10 max-w-[70%] text-left">
        <span className="block font-sans text-lg leading-tight font-black tracking-tight text-[var(--text-headline)]">
          {title}
        </span>
        <span className="mt-1.5 inline-flex rounded-full bg-[var(--text-headline)] px-2 py-0.5 font-sans text-[10px] font-semibold text-[var(--bg-canvas)]">
          {badge}
        </span>
        <span className="mt-1.5 block max-w-[62%] font-sans text-[10px] font-medium leading-snug text-[var(--text-body)] line-clamp-2">
          {caption}
        </span>
      </span>
      <span className="pointer-events-none absolute -bottom-2 -right-2 flex h-28 w-28 select-none items-end justify-end">
        {imageError ? (
          <Icon
            aria-hidden
            className="h-full w-full object-contain object-bottom-right text-[var(--text-headline)]/25"
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
