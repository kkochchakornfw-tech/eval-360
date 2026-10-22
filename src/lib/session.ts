import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { canAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Current signed-in profile, or null. Memoized per request, so the layout and the page
 * share one lookup. The JWT is verified locally; only the profile row is fetched.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireProfile(opts: { allowMustChange?: boolean } = {}): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  // deactivated accounts: sign out (route handler can clear the cookie), then back to login
  if (!profile.is_active) redirect("/auth/signout?error=inactive");
  // first sign-in with a generated PIN / temporary password: choose your own first
  if (profile.must_change_password && !opts.allowMustChange) redirect("/reset-password");
  return profile;
}

/** Heads and admins only; everyone else is bounced to menu 1. */
export async function requireHead(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canAdmin(profile)) redirect("/evaluate");
  return profile;
}

/** Where each person lands after signing in. */
export function homeFor(profile: Pick<Profile, "role" | "is_admin">): string {
  return canAdmin(profile) ? "/dashboard" : "/evaluate";
}
