"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminDashboard } from "@/components/AdminDashboard";
import type { MerchantAccess } from "@/lib/merchantAuth";

export function MerchantAdminDashboard({ access }: { access: MerchantAccess }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/merchant-auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      router.refresh();
      setLoggingOut(false);
    }
  }

  return (
    <AdminDashboard
      onLogout={logout}
      merchant={{
        venueName: access.venue.name,
        role: access.role,
        email: access.email,
      }}
    />
  );
}
