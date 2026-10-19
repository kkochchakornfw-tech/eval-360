/**
 * Creates the first admin of a fresh project (nobody can sign in yet to add people).
 * Usage: npm run create:admin -- "ชื่อ-สกุล" "name@gmail.com"
 * Adds an admin to the roster with that Google address; they then press "เข้าสู่ระบบด้วย Google"
 * on the login page and the profile is linked on first sign-in. Needs NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local, and the migrations (incl. 0005_google_login) applied.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

async function main() {
  const [name, googleEmail] = process.argv.slice(2).map((a) => a.trim());
  if (!name || !googleEmail || !googleEmail.includes("@")) {
    throw new Error('Usage: npm run create:admin -- "ชื่อ-สกุล" "name@gmail.com"');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await admin.from("profiles").insert({
    full_name: name,
    google_email: googleEmail.toLowerCase(),
    role: "head",
    is_admin: true,
    counts_in_score: false,
    has_account: false,
  });
  if (error) throw new Error(error.message);

  console.log(`\nเพิ่มแอดมินแล้ว: ${name} (${googleEmail})`);
  console.log('เข้าสู่ระบบ: กด "เข้าสู่ระบบด้วย Google" ด้วยอีเมลนี้\n');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
