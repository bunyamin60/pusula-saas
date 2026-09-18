type BrandLogoSize = "hero" | "header";

const SIZE_CLASS: Record<BrandLogoSize, string> = {
  hero: "mx-auto h-24 w-24 rounded-2xl p-2.5",
  header: "h-11 w-11 rounded-xl p-1.5",
};

export function BrandLogo({
  src,
  alt,
  size,
}: {
  src?: string;
  alt: string;
  size: BrandLogoSize;
}) {
  const initials = alt.trim().slice(0, 2);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-[var(--border)] bg-[var(--logo-well)] shadow-sm ${SIZE_CLASS[size]}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <span
          className={`font-sans font-black uppercase tracking-wide text-[var(--text-headline)] ${
            size === "hero" ? "text-lg" : "text-[10px]"
          }`}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
