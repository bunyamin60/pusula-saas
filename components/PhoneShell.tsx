import type { ReactNode } from "react";

export function PhoneShell({
  children,
  paddedBottom = false,
}: {
  children: ReactNode;
  paddedBottom?: boolean;
}) {
  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-[var(--card-surface)]">
      <div
        className={`relative mx-auto flex h-[100dvh] min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] shadow-2xl ${
          paddedBottom
            ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
            : "pb-[env(safe-area-inset-bottom)]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
