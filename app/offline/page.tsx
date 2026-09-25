"use client";

import { StatusScreen } from "@/components/StatusScreen";

export default function OfflinePage() {
  return (
    <StatusScreen
      variant="offline"
      onAction={() => window.location.reload()}
    />
  );
}
