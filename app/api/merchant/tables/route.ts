import { getMerchantAuthState } from "@/lib/merchantAuth";
import { getMerchantTableMonitor } from "@/lib/merchantTablesServer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeTenantId } from "@/lib/tenant";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

export async function GET(request: Request) {
  try {
    const requestedVenue = new URL(request.url).searchParams.get("venue");
    const venueSlug = sanitizeTenantId(requestedVenue)?.toLowerCase() ?? null;
    if (!venueSlug) {
      return Response.json(
        { ok: false, reason: "unauthorized" },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    const supabase = await createServerSupabaseClient();
    const authState = await getMerchantAuthState(venueSlug, supabase);
    if (authState.status === "unauthenticated") {
      return Response.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }
    if (authState.status !== "authorized") {
      return Response.json(
        { ok: false, reason: "unauthorized" },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    const data = await getMerchantTableMonitor(authState.access, supabase);
    return Response.json(
      { ok: true, data },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return Response.json(
      { ok: false, reason: "failed" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
