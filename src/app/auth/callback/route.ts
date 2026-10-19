import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validation";

/** PKCE return point (password reset links from resetPasswordForEmail). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Google sign-in rejected by the database (address not on the roster) comes back as ?error=…
  if (searchParams.get("error")) return NextResponse.redirect(`${origin}/login?error=google`);
  const next = safeNext(searchParams.get("next"), "/reset-password");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // an auth user without an active roster profile must not stay signed in
      const { data: claims } = await supabase.auth.getClaims();
      const id = claims?.claims?.sub;
      const { data: profile } = id
        ? await supabase.from("profiles").select("is_active").eq("id", id).maybeSingle()
        : { data: null };
      if (!profile?.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=google`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
