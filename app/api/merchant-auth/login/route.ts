import { getMerchantAuthState } from "@/lib/merchantAuth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return Response.json(
        { ok: false, reason: "invalid-origin" },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      venueSlug?: string;
    };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const venueSlug =
      typeof body.venueSlug === "string"
        ? body.venueSlug.trim().toLowerCase()
        : "";

    if (!email || !password || !venueSlug) {
      return Response.json(
        { ok: false, reason: "invalid" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return Response.json(
        { ok: false, reason: "invalid-credentials" },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const authState = await getMerchantAuthState(venueSlug, supabase);
    if (authState.status !== "authorized") {
      await supabase.auth.signOut({ scope: "local" });
      return Response.json(
        { ok: false, reason: "venue-membership-required" },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    return Response.json(
      {
        ok: true,
        venue: authState.access.venue,
        role: authState.access.role,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return Response.json(
      { ok: false, reason: "failed" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
