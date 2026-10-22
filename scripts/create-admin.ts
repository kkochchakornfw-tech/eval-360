/**
 * Creates the first admin of a fresh project (nobody can sign in yet to create accounts).
 * Usage: npm run create:admin -- "ชื่อ-สกุล"
 * Prints an 8-digit PIN once. Sign in on the login page by picking the name + this PIN;
 * the app then asks for a new PIN. Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * in .env.local, and the migrations applied (through 0007).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

config({ path: ".env.local" });

async function main() {
  const name = process.argv.slice(2).join(" ").trim();
  if (!name) throw new Error('Usage: npm run create:admin -- "ชื่อ-สกุล"');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const pin = Array.from({ length: 8 }, () => String(randomInt(0, 10))).join("");

  // Roster row first, carrying the internal sign-in address; creating the auth user then re-links it
  // (migration 0007 only accepts @pin.eval360.local addresses that already sit on such a row)
  const { data: row, error: insErr } = await admin
    .from("profiles")
    .insert({
      full_name: name,
      role: "head",
      is_admin: true,
      counts_in_score: false,
      has_account: false,
      code_login: true,
      must_change_password: true,
    })
    .select("id")
    .single();
  if (insErr || !row) throw new Error(insErr?.message ?? "could not add the admin to the roster");

  const email = `${row.id}@pin.eval360.local`;
  const { error: setErr } = await admin.from("profiles").update({ email }).eq("id", row.id);
  if (setErr) throw new Error(setErr.message);

  const { error } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) {
    await admin.from("profiles").delete().eq("id", row.id);
    throw new Error(error.message);
  }

  console.log(`\nสร้างแอดมินแล้ว: ${name}`);
  console.log(`PIN (แสดงครั้งเดียว): ${pin}`);
  console.log("เข้าสู่ระบบ: เลือกชื่อนี้ ใส่ PIN แล้วตั้ง PIN ใหม่ของตัวเอง\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
