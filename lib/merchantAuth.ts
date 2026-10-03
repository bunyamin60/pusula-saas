import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MerchantRole = "owner";

export type MerchantAccess = {
  userId: string;
  email: string | null;
  role: MerchantRole;
  venue: {
    id: string;
    name: string;
    slug: string;
  };
};

export type MerchantAuthState =
  | { status: "unauthenticated" }
  | { status: "unauthorized"; email: string | null }
  | { status: "authorized"; access: MerchantAccess };

export async function getMerchantAuthState(
  venueSlug: string,
  client?: SupabaseClient,
): Promise<MerchantAuthState> {
  const supabase = client ?? (await createServerSupabaseClient());
  const { data: claimData, error: claimError } =
    await supabase.auth.getClaims();
  const userId = claimData?.claims.sub;

  if (claimError || !userId) {
    return { status: "unauthenticated" };
  }

  const email =
    typeof claimData.claims.email === "string"
      ? claimData.claims.email
      : null;

  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id, name, slug, is_active")
    .eq("slug", venueSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (venueError || !venue) {
    return { status: "unauthorized", email };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("venue_members")
    .select("role")
    .eq("venue_id", venue.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    membershipError ||
    !membership ||
    membership.role !== "owner"
  ) {
    return { status: "unauthorized", email };
  }

  return {
    status: "authorized",
    access: {
      userId,
      email,
      role: membership.role,
      venue: {
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
      },
    },
  };
}
