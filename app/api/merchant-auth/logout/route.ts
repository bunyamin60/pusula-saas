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

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      return Response.json(
        { ok: false, reason: "failed" },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json(
      { ok: false, reason: "failed" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
