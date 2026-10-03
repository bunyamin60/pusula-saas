import type { NextRequest } from "next/server";
import { updateMerchantSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateMerchantSession(request);
}

export const config = {
  matcher: ["/:tenant/admin/:path*", "/api/merchant-auth/:path*"],
};
