import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Clears the session cookie (Server Components cannot) and returns to the login page. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const supabase = await createClient();
  await supabase.auth.signOut();
  const error = searchParams.get("error");
  return NextResponse.redirect(`${origin}/login${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}
