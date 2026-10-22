import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Always run on the server: a cached response would not touch the database
export const dynamic = "force-dynamic";

/**
 * Keep-alive for free hosting: an uptime monitor calls this every few days so the host stays
 * warm and the free Supabase project registers activity (it pauses after about a week idle).
 * Returns no data, only whether the database answered.
 */
export async function GET() {
  try {
    const { error } = await createAdminClient().from("staff_groups").select("id", { head: true, count: "exact" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
