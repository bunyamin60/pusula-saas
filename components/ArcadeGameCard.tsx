"use client";

import { useState } from "react";
import type { ArcadeGame } from "@/lib/gameCatalog";

type ArcadeGameCardProps = {
  game: ArcadeGame;
  title: string;
  badge: string;
  onClick: () => void;
};

export function ArcadeGameCard({
  game,
  title,
  badge,
  onClick,
}: ArcadeGameCardProps) {
  const [imageError, setImageError] = useState(false);
  const Icon = game.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-36 cursor-pointer overflow-hidden rounded-3xl border-2 border-[var(--text-headline)]/15 bg-[var(--card-surface)] shadow-[0_5px_0_0_rgba(0,0,0,0.08)] transition-all duration-150 select-none hover:translate-y-[3px] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.08)] active:translate-y-[5px] active:shadow-none"
    >
      <span className="absolute top-3 left-3 z-10 max-w-[70%] text-left">
        <span className="block font-sans text-lg leading-tight font-black tracking-tight text-[var(--text-headline)]">
          {title}
        </span>
        <span className="mt-1.5 inline-flex rounded-full bg-[var(--text-headline)] px-2 py-0.5 font-sans text-[10px] font-semibold text-[var(--bg-canvas)]">
          {badge}
        </span>
      </span>
      {imageError ? (
        <Icon
          aria-hidden
          className="pointer-events-none absolute -right-1 -bottom-1 h-24 w-24 text-[var(--text-headline)]/25"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.image}
          alt=""
          onError={() => setImageError(true)}
          className="pointer-events-none absolute -right-3 -bottom-4 h-28 w-28 origin-bottom-right scale-125 object-contain object-bottom"
          style={{ filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.28))" }}
        />
      )}
    </button>
  );
}
